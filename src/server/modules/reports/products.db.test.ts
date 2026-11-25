import { beforeEach, describe, expect, it } from "vitest";
import { ubAt } from "@/lib/time";
import { db } from "@/server/db";
import { createAppointment } from "@/server/modules/appointments/service";
import { createPayment } from "@/server/modules/payments/service";
import { createRefund } from "@/server/modules/refunds/service";
import { checkout } from "@/server/modules/sales/service";
import { makeBookableStaff, makeCustomer, makeService, makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { productAnalytics, productDetail } from "./products";

beforeEach(async () => {
  await resetDb();
});

describe("Тайлан → Бүтээгдэхүүн (A10)", () => {
  it("sold (net of refunds), revenue, used in completed services, by staff and by month", async () => {
    const admin = await makeUser("ADMIN");
    const as = { id: admin.id, role: admin.role };
    const sara = await makeBookableStaff("Сараа");
    const serum = await makeVariant({ price: 60_000, stock: 20 });
    const facial = await makeService({ price: 200_000, durationMin: 60 });
    await db.serviceConsumable.create({ data: { serviceId: facial.id, variantId: serum.id, qtyPerService: 0.25 } });
    const customer = await makeCustomer();

    // POS records no staff on product lines: 3 serums sold together with Сараа's facial → hers
    // (attribution.ts), 1 of them refunded; 1 serum sold alone → unknown
    const r = await checkout(
      { customerId: customer.id, items: [{ kind: "SERVICE", serviceId: facial.id, qty: 1, staffId: sara.id }, { kind: "PRODUCT", variantId: serum.id, qty: 3 }] },
      as,
    );
    await createPayment({ saleId: r.saleId, method: "CARD", amount: r.total, approvalCode: "A1", idempotencyKey: crypto.randomUUID() }, as);
    const item = await db.saleItem.findFirstOrThrow({ where: { saleId: r.saleId, kind: "PRODUCT" } });
    expect(item.staffId).toBeNull();
    await createRefund({ saleId: r.saleId, items: [{ saleItemId: item.id, qty: 1 }], reason: "Харшил", method: "CARD", restock: true }, admin.id);
    const r2 = await checkout({ items: [{ kind: "PRODUCT", variantId: serum.id, qty: 1 }] }, as);
    await createPayment({ saleId: r2.saleId, method: "CASH", amount: r2.total, tendered: r2.total, idempotencyKey: crypto.randomUUID() }, as).catch(async () => {
      await createPayment({ saleId: r2.saleId, method: "CARD", amount: r2.total, approvalCode: "A2", idempotencyKey: crypto.randomUUID() }, as);
    });

    // Two completed facials (0.25 each) and one cancelled (not counted), all by Сараа, today
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(now);
    const appts = [];
    for (const hm of ["10:00", "12:00", "14:00"]) {
      appts.push(await createAppointment({ customerId: customer.id, serviceId: facial.id, staffId: sara.id, startsAt: ubAt(today, hm) }, as, new Date(ubAt(today, "09:00").getTime() - 86_400_000)));
    }
    await db.appointment.updateMany({ where: { id: { in: [appts[0]!.id, appts[1]!.id] } }, data: { status: "DONE" } });
    await db.appointment.update({ where: { id: appts[2]!.id }, data: { status: "CANCELLED" } });

    const range = { from: today, to: today };
    const [row] = await productAnalytics(range);
    expect(row).toMatchObject({ variantId: serum.id, soldQty: 3, revenue: 180_000, usedQty: 0.5 });
    expect(row!.byStaff).toEqual([
      { staffId: sara.id, name: "Сараа", soldQty: 2, revenue: 120_000, usedQty: 0.5 },
      { staffId: "none", name: null, soldQty: 1, revenue: 60_000, usedQty: 0 },
    ]);

    const d = await productDetail(serum.id, range);
    expect(d.months).toHaveLength(12);
    expect(d.months.at(-1)).toEqual({ month: today.slice(0, 7), soldQty: 3, revenue: 180_000, usedQty: 0.5 });
    expect(d.months.slice(0, -1).every((m) => m.soldQty === 0 && m.usedQty === 0)).toBe(true);

    expect(await productAnalytics({ from: "2020-01-01", to: "2020-01-31" })).toEqual([]);
  });
});
