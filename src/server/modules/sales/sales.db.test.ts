import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { makeCustomer, makeService, makeUser, makeVariant, resetDb, variantStock } from "../../../../tests/db-helpers";
import { applyPayment } from "./finalize";
import { APPROVAL_REQUIRED, cancel, checkout, unlock, unlockStaleSales } from "./service";

let manager: Awaited<ReturnType<typeof makeUser>>;
let staff: Awaited<ReturnType<typeof makeUser>>;
const asManager = () => ({ id: manager.id, role: manager.role });

beforeEach(async () => {
  await resetDb();
  manager = await makeUser("MANAGER");
  staff = await makeUser("STAFF");
});

/** Төлбөрийг шууд DB-д SUCCEEDED болгоно (payments модулийн тестээс тусдаа) */
async function pay(saleId: string, amount: number, key = crypto.randomUUID()) {
  await db.payment.create({
    data: { saleId, method: "CARD", amount, status: "SUCCEEDED", idempotencyKey: key, createdById: manager.id, approvalCode: "X", paidAt: new Date() },
  });
  return db.$transaction((tx) => applyPayment(tx, saleId, manager.id));
}

describe("checkout / lock", () => {
  it("prices from the DB, allocates the sale discount, numbers and reserves stock", async () => {
    const facial = await makeService({ price: 250_000 });
    const serum = await makeVariant({ price: 180_000, stock: 5, cost: 90_000 });
    const r = await checkout(
      {
        items: [
          { kind: "SERVICE", serviceId: facial.id, qty: 1, staffId: staff.id },
          { kind: "PRODUCT", variantId: serum.id, qty: 1 },
        ],
        saleDiscount: { type: "AMOUNT", value: 20_000 },
        saleDiscountReason: "Анхны айлчлал",
      },
      asManager(),
    );
    expect(r.total).toBe(410_000);
    expect(r.number).toMatch(/^CL-\d{8}-0001$/);
    const sale = await db.sale.findUniqueOrThrow({ where: { id: r.saleId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    expect(sale.status).toBe("PENDING_PAYMENT");
    expect(sale.items.map((i) => i.allocatedSaleDiscount)).toEqual([11_628, 8_372]);
    expect(sale.items[1]!.unitCostSnapshot).toBe(90_000);
    expect(await variantStock(serum.id)).toEqual({ stock: 5, reserved: 1 });
  });

  it("numbers are sequential per day and gap-free when a lock fails", async () => {
    const v = await makeVariant({ price: 1_000, stock: 1 });
    const a = await checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, asManager());
    // Үлдэгдэл хүрэлцэхгүй → rollback, дугаар зарцуулагдахгүй
    await expect(checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, asManager())).rejects.toThrow(/Үлдэгдэл хүрэлцэхгүй/);
    const other = await makeVariant({ price: 1_000, stock: 1 });
    const b = await checkout({ items: [{ kind: "PRODUCT", variantId: other.id, qty: 1 }] }, asManager());
    expect(a.number.slice(-4)).toBe("0001");
    expect(b.number.slice(-4)).toBe("0002");
  });

  it("insufficient stock rolls the whole sale back", async () => {
    const ok = await makeVariant({ price: 1_000, stock: 5 });
    const short = await makeVariant({ price: 1_000, stock: 1, name: "MASQUE" });
    await expect(
      checkout({ items: [{ kind: "PRODUCT", variantId: ok.id, qty: 2 }, { kind: "PRODUCT", variantId: short.id, qty: 2 }] }, asManager()),
    ).rejects.toThrow("Үлдэгдэл хүрэлцэхгүй: MASQUE · 30 мл");
    expect(await variantStock(ok.id)).toEqual({ stock: 5, reserved: 0 });
    expect(await db.sale.count()).toBe(0);
  });

  it("two concurrent locks on the last unit: exactly one succeeds", async () => {
    const v = await makeVariant({ price: 1_000, stock: 1 });
    const results = await Promise.allSettled([
      checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, asManager()),
      checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, asManager()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await variantStock(v.id)).toEqual({ stock: 1, reserved: 1 });
  });

  it("requires a staff member on service lines and a reason on discounts", async () => {
    const facial = await makeService({ price: 100_000 });
    await expect(checkout({ items: [{ kind: "SERVICE", serviceId: facial.id, qty: 1 }] }, asManager())).rejects.toThrow(/ажилтныг/);
    await expect(
      checkout({ items: [{ kind: "SERVICE", serviceId: facial.id, qty: 1, staffId: staff.id }], saleDiscount: { type: "AMOUNT", value: 1 } }, asManager()),
    ).rejects.toThrow();
  });

  it("discount over the limit: MANAGER approves it themself (11/24 — same as ADMIN)", async () => {
    const v = await makeVariant({ price: 100_000, stock: 5 });
    const cart = {
      items: [{ kind: "PRODUCT" as const, variantId: v.id, qty: 1 }],
      saleDiscount: { type: "PERCENT" as const, percent: 15 },
      saleDiscountReason: "VIP",
    };
    const r = await checkout(cart, asManager());
    expect(r.total).toBe(85_000);
    const sale = await db.sale.findUniqueOrThrow({ where: { id: r.saleId } });
    expect(sale.discountApprovedById).toBe(manager.id);
  });

  it("discount over the limit without the right: asks for MANAGER/ADMIN credentials, never STAFF", async () => {
    // A role without discount:over-limit (STAFF here) gets APPROVAL_REQUIRED and needs someone who has it
    const approver = await makeUser("MANAGER", { password: "manager-pass" });
    const beautician = await makeUser("STAFF", { password: "staff-pass" });
    const v = await makeVariant({ price: 100_000, stock: 5 });
    const cart = {
      items: [{ kind: "PRODUCT" as const, variantId: v.id, qty: 1 }],
      saleDiscount: { type: "PERCENT" as const, percent: 15 },
      saleDiscountReason: "VIP",
    };
    const asStaff = { id: staff.id, role: staff.role };
    await expect(checkout(cart, asStaff)).rejects.toMatchObject({ code: APPROVAL_REQUIRED });
    await expect(checkout(cart, asStaff, { email: beautician.email, password: "staff-pass" })).rejects.toThrow(/буруу/);
    await expect(checkout(cart, asStaff, { email: approver.email, password: "wrong" })).rejects.toThrow(/буруу/);
    const r = await checkout(cart, asStaff, { email: approver.email, password: "manager-pass" });
    const sale = await db.sale.findUniqueOrThrow({ where: { id: r.saleId } });
    expect(sale.discountApprovedById).toBe(approver.id);
    expect(await db.auditLog.count({ where: { action: "sale.discount_approved", userId: approver.id } })).toBe(1);
  });

  it("exactly 10% is allowed without approval", async () => {
    const v = await makeVariant({ price: 100_000, stock: 5 });
    const r = await checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }], saleDiscount: { type: "PERCENT", percent: 10 }, saleDiscountReason: "x" }, asManager());
    expect(r.total).toBe(90_000);
  });

  it("service cost snapshot = Σ consumable share × cost", async () => {
    const lotion = await makeVariant({ price: 280_000, stock: 3, cost: 150_000 });
    const mask = await makeVariant({ price: 260_000, stock: 3, cost: 130_000 });
    const facial = await makeService({ price: 250_000, consumables: [{ variantId: lotion.id, qty: 0.03 }, { variantId: mask.id, qty: 0.1 }] });
    const r = await checkout({ items: [{ kind: "SERVICE", serviceId: facial.id, qty: 1, staffId: staff.id }] }, asManager());
    const item = await db.saleItem.findFirstOrThrow({ where: { saleId: r.saleId } });
    expect(item.unitCostSnapshot).toBe(4_500 + 13_000);
    // орцыг үлдэгдлээс хасахгүй
    expect(await variantStock(lotion.id)).toEqual({ stock: 3, reserved: 0 });
  });
});

describe("unlock / cancel", () => {
  it("unlock releases the reservation and keeps the number; re-lock reuses it", async () => {
    const v = await makeVariant({ price: 1_000, stock: 2 });
    const r = await checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 2 }] }, asManager());
    await unlock(r.saleId, manager.id);
    expect(await variantStock(v.id)).toEqual({ stock: 2, reserved: 0 });
    const again = await checkout({ saleId: r.saleId, items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, asManager());
    expect(again.saleId).toBe(r.saleId);
    expect(again.number).toBe(r.number);
    expect(await variantStock(v.id)).toEqual({ stock: 2, reserved: 1 });
  });

  it("cannot unlock or cancel once something is paid", async () => {
    const v = await makeVariant({ price: 10_000, stock: 2 });
    const r = await checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, asManager());
    await pay(r.saleId, 4_000); // → PARTIALLY_PAID
    await expect(unlock(r.saleId, manager.id)).rejects.toThrow();
    await expect(cancel(r.saleId, manager.id)).rejects.toThrow();
    // Төлбөр SUCCEEDED боловч төлөв хараахан шинэчлэгдээгүй ч (PENDING_PAYMENT) хориглоно
    await db.sale.update({ where: { id: r.saleId }, data: { status: "PENDING_PAYMENT" } });
    await expect(unlock(r.saleId, manager.id)).rejects.toThrow(/Буцаалт/);
    await expect(cancel(r.saleId, manager.id)).rejects.toThrow(/Буцаалт/);
  });

  it("cancel releases stock", async () => {
    const v = await makeVariant({ price: 1_000, stock: 2 });
    const r = await checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 2 }] }, asManager());
    await cancel(r.saleId, manager.id);
    expect((await db.sale.findUniqueOrThrow({ where: { id: r.saleId } })).status).toBe("CANCELLED");
    expect(await variantStock(v.id)).toEqual({ stock: 2, reserved: 0 });
  });

  it("stale PENDING_PAYMENT sales are auto-unlocked by the worker sweep", async () => {
    const v = await makeVariant({ price: 1_000, stock: 1 });
    const r = await checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, asManager());
    await db.sale.update({ where: { id: r.saleId }, data: { lockedAt: new Date(Date.now() - 31 * 60_000) } });
    expect(await unlockStaleSales(30)).toEqual([r.saleId]);
    expect(await variantStock(v.id)).toEqual({ stock: 1, reserved: 0 });
    expect(await db.auditLog.count({ where: { action: "sale.unlock", userId: null } })).toBe(1);
  });
});

describe("applyPayment (finalize)", () => {
  it("partial then full payment; stock deducted once, movement + email job written", async () => {
    const customer = await makeCustomer();
    const v = await makeVariant({ price: 10_000, stock: 3, cost: 4_000 });
    const visit = await db.visit.create({
      data: { branchId: (await db.branch.findFirstOrThrow()).id, customerId: customer.id, conductedById: manager.id, recommendations: { create: [{ variantId: v.id }] } },
    });
    const r = await checkout({ customerId: customer.id, visitId: visit.id, items: [{ kind: "PRODUCT", variantId: v.id, qty: 2 }] }, asManager());

    expect((await pay(r.saleId, 5_000)).status).toBe("PARTIALLY_PAID");
    expect(await variantStock(v.id)).toEqual({ stock: 3, reserved: 2 });

    expect((await pay(r.saleId, 15_000)).status).toBe("PAID");
    expect(await variantStock(v.id)).toEqual({ stock: 1, reserved: 0 });
    const moves = await db.stockMovement.findMany({ where: { saleId: r.saleId } });
    expect(moves.map((m) => [m.type, m.qty, m.unitCost])).toEqual([["SALE", -2, 4_000]]);
    expect(await db.outboxJob.count({ where: { type: "VISIT_EMAIL" } })).toBe(1);
    const v2 = await db.visit.findUniqueOrThrow({ where: { id: visit.id }, include: { recommendations: true } });
    expect(v2.emailStatus).toBe("QUEUED");
    expect(v2.recommendations[0]!.purchased).toBe(true);
  });

  it("concurrent applyPayment calls deduct stock and enqueue the email exactly once", async () => {
    const customer = await makeCustomer();
    const v = await makeVariant({ price: 10_000, stock: 3 });
    const visit = await db.visit.create({ data: { branchId: (await db.branch.findFirstOrThrow()).id, customerId: customer.id, conductedById: manager.id } });
    const r = await checkout({ customerId: customer.id, visitId: visit.id, items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, asManager());
    await db.payment.create({
      data: { saleId: r.saleId, method: "CARD", amount: 10_000, status: "SUCCEEDED", idempotencyKey: crypto.randomUUID(), createdById: manager.id, approvalCode: "A" },
    });
    const results = await Promise.all(
      Array.from({ length: 4 }, () => db.$transaction((tx) => applyPayment(tx, r.saleId, manager.id))),
    );
    expect(results.filter((x) => x.finalized)).toHaveLength(1);
    expect(await variantStock(v.id)).toEqual({ stock: 2, reserved: 0 });
    expect(await db.stockMovement.count({ where: { saleId: r.saleId } })).toBe(1);
    expect(await db.outboxJob.count()).toBe(1);
  });

  it("no email job without a customer email", async () => {
    const customer = await makeCustomer({ email: null });
    const v = await makeVariant({ price: 1_000, stock: 1 });
    const visit = await db.visit.create({ data: { branchId: (await db.branch.findFirstOrThrow()).id, customerId: customer.id, conductedById: manager.id } });
    const r = await checkout({ customerId: customer.id, visitId: visit.id, items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, asManager());
    await pay(r.saleId, 1_000);
    expect(await db.outboxJob.count()).toBe(0);
  });

  it("a 100% discounted sale is completed at lock without payment", async () => {
    const admin = await makeUser("ADMIN");
    const v = await makeVariant({ price: 5_000, stock: 1 });
    const r = await checkout(
      { items: [{ kind: "PRODUCT", variantId: v.id, qty: 1, lineDiscount: { type: "PERCENT", percent: 100 }, lineDiscountReason: "Бэлэг" }] },
      { id: admin.id, role: admin.role },
    );
    expect(r.status).toBe("PAID");
    expect(await variantStock(v.id)).toEqual({ stock: 0, reserved: 0 });
  });

  it("checkout errors are user-facing", async () => {
    await expect(checkout({ items: [{ kind: "PRODUCT", variantId: "missing", qty: 1 }] }, asManager())).rejects.toBeInstanceOf(UserError);
  });
});
