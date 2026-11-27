import { beforeEach, describe, expect, it } from "vitest";
import type { PayMethod } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { makeService, makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { loadReport } from "./queries";

let admin: Awaited<ReturnType<typeof makeUser>>;
let staff: Awaited<ReturnType<typeof makeUser>>;
let seq = 0;
let refs: Map<string, string>;
beforeEach(async () => {
  refs = new Map();
  await resetDb();
  admin = await makeUser("ADMIN");
  staff = await makeUser("STAFF");
});

type Line = { kind: "SERVICE" | "PRODUCT"; name: string; unitPrice: number; qty?: number; lineDiscount?: number; allocated?: number; vat?: number; cost?: number; staffId?: string | null; variantId?: string | null };

/** A paid sale written directly (the report only reads) */
async function sale(paidAt: string, lines: Line[], pay: [PayMethod, number][], status: "PAID" | "PARTIALLY_PAID" | "PARTIALLY_REFUNDED" = "PAID") {
  const branch = await getCurrentBranch();
  // SaleItem_kind_ref_check: SERVICE → serviceId, PRODUCT → variantId
  for (const l of lines) {
    if (l.kind === "SERVICE" && !refs.has(l.name)) refs.set(l.name, (await makeService({ price: l.unitPrice, name: l.name })).id);
    if (l.kind === "PRODUCT" && !l.variantId && !refs.has(l.name)) refs.set(l.name, (await makeVariant({ price: l.unitPrice, stock: 10, name: l.name })).id);
  }
  const items = lines.map((l, i) => {
    const qty = l.qty ?? 1;
    return {
      kind: l.kind,
      nameSnapshot: l.name,
      unitPrice: l.unitPrice,
      qty,
      lineDiscount: l.lineDiscount ?? 0,
      allocatedSaleDiscount: l.allocated ?? 0,
      lineTotal: l.unitPrice * qty - (l.lineDiscount ?? 0) - (l.allocated ?? 0),
      vatAmount: l.vat ?? 0,
      unitCostSnapshot: l.cost ?? 0,
      staffId: l.staffId === undefined ? (l.kind === "SERVICE" ? staff.id : null) : l.staffId,
      serviceId: l.kind === "SERVICE" ? refs.get(l.name)! : null,
      variantId: l.kind === "PRODUCT" ? (l.variantId ?? refs.get(l.name)!) : null,
      sortOrder: i,
    };
  });
  const total = items.reduce((s, x) => s + x.lineTotal, 0);
  const paid = pay.reduce((s, [, a]) => s + a, 0);
  return db.sale.create({
    data: {
      branchId: branch.id,
      createdById: admin.id,
      status,
      number: `T-${++seq}`,
      subtotal: total,
      total,
      paidAmount: paid,
      paidAt: status === "PARTIALLY_PAID" ? null : new Date(paidAt),
      createdAt: new Date(paidAt),
      items: { create: items },
      payments: {
        create: pay.map(([method, amount]) => ({ method, amount, ...(method === "CASH" ? { tendered: amount, change: 0 } : {}), status: "SUCCEEDED" as const, idempotencyKey: `k-${++seq}`, createdById: admin.id, paidAt: new Date(paidAt) })),
      },
    },
    include: { items: true },
  });
}

const NOV = { from: "2026-11-01", to: "2026-11-30" };

describe("reports", () => {
  it("split payment: service + product = total; payment methods add up", async () => {
    await sale("2026-11-10T04:00:00Z", [
      { kind: "SERVICE", name: "Нүүрний эмчилгээ", unitPrice: 100_000, vat: 9_091 },
      { kind: "PRODUCT", name: "LOTION P50 · 250 мл", unitPrice: 50_000, vat: 4_545 },
    ], [["CASH", 60_000], ["CARD", 90_000]]);
    const r = await loadReport(NOV, { canCost: false });
    expect(r.kpi).toMatchObject({ total: 150_000, service: 100_000, serviceOneTime: 100_000, serviceCourse: 0, product: 50_000, sales: 1, average: 150_000, serviceQty: 1, productQty: 1 });
    expect(r.kpi.service + r.kpi.product).toBe(r.kpi.total);
    expect(r.kpi.net).toBe(150_000 - 13_636);
    expect(r.payments).toEqual([{ method: "CARD", amount: 90_000 }, { method: "CASH", amount: 60_000 }]);
    expect(r.days.find((d) => d.day === "2026-11-10")).toEqual({ day: "2026-11-10", service: 100_000, product: 50_000 });
    expect(r.days).toHaveLength(30);
  });

  it("partial refund is taken off in the month it was sold (lines, totals and method)", async () => {
    const s = await sale("2026-11-12T04:00:00Z", [{ kind: "PRODUCT", name: "SÉRUM · 30 мл", unitPrice: 50_000, qty: 2, cost: 20_000 }], [["CARD", 100_000]], "PARTIALLY_REFUNDED");
    await db.refund.create({
      data: { saleId: s.id, amount: 50_000, reason: "т", status: "COMPLETED", method: "CARD", requestedById: admin.id, completedAt: new Date("2026-12-03T04:00:00Z"), items: [{ saleItemId: s.items[0]!.id, qty: 1, amount: 50_000 }] },
    });
    const r = await loadReport(NOV, { canCost: true });
    expect(r.kpi).toMatchObject({ total: 50_000, product: 50_000, productQty: 1, refunds: 50_000, refundCount: 1 });
    expect(r.byProduct[0]).toMatchObject({ name: "SÉRUM · 30 мл", qty: 1, amount: 50_000, margin: 60 });
    expect(r.payments).toEqual([{ method: "CARD", amount: 50_000 }]);
    // A requested (not completed) refund does not count
    await db.refund.create({ data: { saleId: s.id, amount: 50_000, reason: "т", status: "REQUESTED", method: "CARD", requestedById: admin.id, items: [{ saleItemId: s.items[0]!.id, qty: 1, amount: 50_000 }] } });
    expect((await loadReport(NOV, { canCost: true })).kpi.total).toBe(50_000);
  });

  it("discounts: line + allocated sale discount are already out of the amount", async () => {
    await sale("2026-11-15T04:00:00Z", [{ kind: "SERVICE", name: "Оношлогоо", unitPrice: 100_000, lineDiscount: 10_000, allocated: 5_000 }], [["QPAY", 85_000]]);
    const r = await loadReport(NOV, { canCost: false });
    expect(r.kpi.total).toBe(85_000);
    expect(r.byService).toEqual([{ key: refs.get("Оношлогоо"), name: "Оношлогоо", qty: 1, amount: 85_000 }]);
  });

  it("Ulaanbaatar midnight decides the day (UTC+8)", async () => {
    await sale("2026-11-30T15:59:59Z", [{ kind: "SERVICE", name: "A", unitPrice: 10_000 }], [["CASH", 10_000]]); // 23:59:59 on Nov 30 (UB)
    await sale("2026-11-30T16:00:00Z", [{ kind: "SERVICE", name: "B", unitPrice: 20_000 }], [["CASH", 20_000]]); // 00:00 on Dec 1 (UB)
    const nov = await loadReport(NOV, { canCost: false });
    expect(nov.kpi.total).toBe(10_000);
    expect(nov.days.at(-1)).toEqual({ day: "2026-11-30", service: 10_000, product: 0 });
    const dec1 = await loadReport({ from: "2026-12-01", to: "2026-12-01" }, { canCost: false });
    expect(dec1.kpi.total).toBe(20_000);
  });

  it("empty period: zeros, every day present, no breakdown rows", async () => {
    const r = await loadReport({ from: "2026-10-01", to: "2026-10-07" }, { canCost: true });
    expect(r.kpi).toMatchObject({ total: 0, sales: 0, average: 0, refunds: 0, pending: 0 });
    expect(r.days).toHaveLength(7);
    expect(r.byService).toEqual([]);
    expect(r.payments).toEqual([]);
  });

  it("by staff: product lines without a staff member go to 'unknown'; margin only with cost:read", async () => {
    const v = await makeVariant({ price: 40_000, stock: 5, cost: 10_000 });
    await sale("2026-11-20T04:00:00Z", [
      { kind: "SERVICE", name: "Эмчилгээ", unitPrice: 200_000 },
      { kind: "PRODUCT", name: "SERUM · 30 мл", unitPrice: 40_000, cost: 10_000, variantId: v.id },
    ], [["CARD", 240_000]]);
    const r = await loadReport(NOV, { canCost: false });
    expect(r.byStaff).toEqual([
      { key: staff.id, name: staff.name, amount: 200_000, service: 200_000, product: 0, services: [{ key: refs.get("Эмчилгээ"), name: "Эмчилгээ", qty: 1, amount: 200_000 }] },
      { key: "none", name: null, amount: 40_000, service: 0, product: 40_000, services: [] },
    ]);
    expect(r.byProduct[0]!.margin).toBeUndefined();
    expect((await loadReport(NOV, { canCost: true })).byProduct[0]!.margin).toBe(75);
  });

  it("pending = unpaid part of partially paid sales", async () => {
    await sale("2026-11-21T04:00:00Z", [{ kind: "SERVICE", name: "X", unitPrice: 200_000 }], [["CASH", 50_000]], "PARTIALLY_PAID");
    const r = await loadReport(NOV, { canCost: false });
    expect(r.kpi).toMatchObject({ pending: 150_000, pendingCount: 1, total: 0, sales: 0 });
  });
});

describe("суваг (PROMPT 27)", () => {
  it("Касс (POS) / Онлайн (Sale.channel ONLINE эсвэл сайтаар захиалсан цаг) — нийлбэр нийт орлоготой тэнцүү", async () => {
    await sale("2026-03-10T04:00:00Z", [{ kind: "PRODUCT", name: "SERUM", unitPrice: 100_000 }], [["CASH", 100_000]]);
    const onl = await sale("2026-03-10T05:00:00Z", [{ kind: "SERVICE", name: "FACIAL", unitPrice: 300_000 }], [["CARD", 300_000]]);
    await db.sale.update({ where: { id: onl.id }, data: { channel: "ONLINE" } });
    // Сайтаар захиалсан цагийн борлуулалт (POS-оор төлсөн ч) → онлайн
    const viaAppt = await sale("2026-03-10T06:00:00Z", [{ kind: "SERVICE", name: "FACIAL", unitPrice: 200_000 }], [["QPAY", 200_000]]);
    const customer = await db.customer.create({ data: { name: "Онлайн Захиалагч", phone: "99887766" } });
    const svc = await db.service.findFirstOrThrow({ where: { name: "FACIAL" } });
    const branch = await getCurrentBranch();
    const at = new Date("2026-03-10T05:30:00Z");
    const appt = await db.appointment.create({
      data: { customerId: customer.id, serviceId: svc.id, staffId: staff.id, branchId: branch.id, startsAt: at, endsAt: new Date(at.getTime() + 3_600_000), blockedUntil: new Date(at.getTime() + 3_600_000), source: "ONLINE" },
    });
    await db.sale.update({ where: { id: viaAppt.id }, data: { appointmentId: appt.id } });

    const r = await loadReport({ from: "2026-03-10", to: "2026-03-10" }, { canCost: false });
    expect(r.byChannel).toEqual([
      { channel: "POS", amount: 100_000, service: 0, product: 100_000, sales: 1 },
      { channel: "ONLINE", amount: 500_000, service: 500_000, product: 0, sales: 2 },
    ]);
    expect(r.byChannel.reduce((s, c) => s + c.amount, 0)).toBe(r.kpi.total);
  });
});
