/**
 * Бүтээгдэхүүний мөрийн "Зарсан" ажилтан (PROMPT 14 §5): POS анхдагч, засвар (audit, цалингийн түгжээ), backfill.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ubDateKey } from "@/lib/time";
import { db } from "@/server/db";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { toDbDate } from "@/server/modules/payroll/dates";
import { createPayment } from "@/server/modules/payments/service";
import { makeCustomer, makeService, makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { backfillSellers, setItemSeller } from "./seller";
import { checkout } from "./service";

let admin: Awaited<ReturnType<typeof makeUser>>;
let sara: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser("MANAGER");
  sara = await makeUser("STAFF");
});
const as = () => ({ id: admin.id, role: admin.role });

async function sell(items: Parameters<typeof checkout>[0]["items"], extra: { appointmentId?: string } = {}) {
  const r = await checkout({ items, ...extra }, as());
  await createPayment({ saleId: r.saleId, method: "CARD", amount: r.total, approvalCode: "AP1", idempotencyKey: crypto.randomUUID() }, as());
  return db.saleItem.findFirstOrThrow({ where: { saleId: r.saleId, kind: "PRODUCT" } });
}

describe('"Зарсан" ажилтан', () => {
  it("анхдагч: цагийн гоо сайханч, цаггүй бол кассчин; сонгосон нь давуу; нягтланг сонгохгүй", async () => {
    const serum = await makeVariant({ price: 60_000, stock: 20 });
    const facial = await makeService({ price: 200_000 });
    const customer = await makeCustomer();
    const branch = await getCurrentBranch();
    const at = new Date();
    const end = new Date(at.getTime() + 3_600_000);
    const appt = await db.appointment.create({
      data: { branchId: branch.id, customerId: customer.id, staffId: sara.id, serviceId: facial.id, startsAt: at, endsAt: end, blockedUntil: end, status: "ARRIVED" },
    });

    expect((await sell([{ kind: "PRODUCT", variantId: serum.id, qty: 1 }])).sellerId).toBe(admin.id);
    expect((await sell([{ kind: "PRODUCT", variantId: serum.id, qty: 1 }], { appointmentId: appt.id })).sellerId).toBe(sara.id);
    const other = await makeUser("STAFF");
    expect((await sell([{ kind: "PRODUCT", variantId: serum.id, qty: 1, sellerId: other.id }], { appointmentId: appt.id })).sellerId).toBe(other.id);

    const acct = await makeUser("ACCOUNTANT");
    await expect(checkout({ items: [{ kind: "PRODUCT", variantId: serum.id, qty: 1, sellerId: acct.id }] }, as())).rejects.toThrow(/зарсан ажилтан/);
  });

  it("борлуулалтын дараа засна (AuditLog); тухайн өдрийн цалин батлагдсан бол хориглоно", async () => {
    const serum = await makeVariant({ price: 60_000, stock: 5 });
    const item = await sell([{ kind: "PRODUCT", variantId: serum.id, qty: 1 }]);
    await setItemSeller(item.id, sara.id, admin.id);
    expect((await db.saleItem.findUniqueOrThrow({ where: { id: item.id } })).sellerId).toBe(sara.id);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "sale.seller" } });
    expect(log).toMatchObject({ before: { sellerId: admin.id }, after: { sellerId: sara.id } });

    const today = ubDateKey();
    await db.payrollPeriod.create({ data: { startDate: toDbDate(today), endDate: toDbDate(today), status: "APPROVED" } });
    await expect(setItemSeller(item.id, admin.id, admin.id)).rejects.toThrow(/батлагдсан/);
  });

  it("backfill: хуучин мөрөнд үйлчилгээний ажилтнаас нөхнө; dry-run бичихгүй", async () => {
    const serum = await makeVariant({ price: 60_000, stock: 5 });
    const facial = await makeService({ price: 200_000 });
    const r = await checkout({ items: [{ kind: "SERVICE", serviceId: facial.id, qty: 1, staffId: sara.id }, { kind: "PRODUCT", variantId: serum.id, qty: 1 }] }, as());
    const lone = await sell([{ kind: "PRODUCT", variantId: serum.id, qty: 1 }]);
    // Хуучин өгөгдөл: sellerId-гүй
    await db.saleItem.updateMany({ where: { kind: "PRODUCT" }, data: { sellerId: null } });

    expect(await backfillSellers({ dryRun: true })).toEqual({ candidates: 1, filled: 0 });
    expect(await db.saleItem.count({ where: { sellerId: { not: null } } })).toBe(0);
    expect(await backfillSellers({ dryRun: false })).toEqual({ candidates: 1, filled: 1 });
    const filled = await db.saleItem.findFirstOrThrow({ where: { saleId: r.saleId, kind: "PRODUCT" } });
    expect(filled.sellerId).toBe(sara.id);
    // Ажилтан тодорхойгүй мөр NULL хэвээр
    expect((await db.saleItem.findUniqueOrThrow({ where: { id: lone.id } })).sellerId).toBeNull();
  });
});
