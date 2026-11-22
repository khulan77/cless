import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { closeShift, openShift } from "@/server/modules/cash-shifts/service";
import { checkout } from "@/server/modules/sales/service";
import { makeUser, makeVariant, resetDb, variantStock } from "../../../../tests/db-helpers";
import { setQPayProviderForTests } from "./providers/qpay";
import type { QPayCheckResult, QPayProvider } from "./providers/qpay/types";
import { cancelPayment, createPayment, pollProcessingQPayPayments, verifyQPayPayment } from "./service";

let manager: Awaited<ReturnType<typeof makeUser>>;
let admin: Awaited<ReturnType<typeof makeUser>>;
const asManager = () => ({ id: manager.id, role: manager.role });
const asAdmin = () => ({ id: admin.id, role: admin.role });
const key = () => crypto.randomUUID();

/** Mock QPay: check-ийн хариуг тестээс удирдана */
class MockQPay implements QPayProvider {
  invoices = 0;
  checks = 0;
  cancelled: string[] = [];
  next: QPayCheckResult = { paid: false, paidAmount: 0, raw: {} };
  failCreate = false;
  async createInvoice(p: { paymentId: string; amount: number }) {
    if (this.failCreate) throw new Error("boom");
    this.invoices++;
    return { invoiceId: `inv_${p.paymentId}_${this.invoices}`, qrText: "QR", deeplinks: [{ name: "Khan", link: "khanbank://q" }], raw: {} };
  }
  async checkPayment() {
    this.checks++;
    return this.next;
  }
  async cancelInvoice(id: string) {
    this.cancelled.push(id);
  }
}
let qpay: MockQPay;

beforeEach(async () => {
  await resetDb();
  manager = await makeUser("MANAGER");
  admin = await makeUser("ADMIN");
  qpay = new MockQPay();
  setQPayProviderForTests(qpay);
});
afterEach(() => setQPayProviderForTests(null));

async function lockedSale(price = 410_000, stock = 3) {
  const v = await makeVariant({ price, stock });
  const r = await checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, asManager());
  return { ...r, variantId: v.id };
}

describe("createPayment", () => {
  it("CASH requires an open shift", async () => {
    const s = await lockedSale();
    await expect(createPayment({ saleId: s.saleId, method: "CASH", amount: 1000, tendered: 1000, idempotencyKey: key() }, asManager())).rejects.toThrow(
      /кассаа нээнэ/,
    );
  });

  it("split payment (QPay manual + cash with change) → PAID, stock deducted, cash movement recorded", async () => {
    const shift = await openShift({ openingCash: 50_000 }, manager.id);
    const s = await lockedSale();
    const q = await createPayment({ saleId: s.saleId, method: "QPAY", amount: 300_000, externalRef: "QP123456", idempotencyKey: key() }, asManager());
    expect(q.payment.status).toBe("SUCCEEDED");
    expect(q.sale.status).toBe("PARTIALLY_PAID");

    const c = await createPayment({ saleId: s.saleId, method: "CASH", amount: 110_000, tendered: 120_000, idempotencyKey: key() }, asManager());
    expect(c.payment.change).toBe(10_000);
    expect(c.sale.status).toBe("PAID");
    expect(await variantStock(s.variantId)).toEqual({ stock: 2, reserved: 0 });

    const closed = await closeShift({ shiftId: shift.id, countedCash: 160_000 }, { id: manager.id, canAll: false });
    expect(closed.expectedCash).toBe(160_000);
    expect(closed.difference).toBe(0);
  });

  it("is idempotent by key (sequential and concurrent)", async () => {
    const s = await lockedSale();
    const k = key();
    const input = { saleId: s.saleId, method: "CARD" as const, amount: 100_000, approvalCode: "A1", idempotencyKey: k };
    const results = await Promise.allSettled([createPayment(input, asManager()), createPayment(input, asManager()), createPayment(input, asManager())]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok.length).toBeGreaterThan(0);
    const ids = new Set(ok.map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof createPayment>>>).value.payment.id));
    expect(ids.size).toBe(1);
    const again = await createPayment(input, asManager());
    expect(ids.has(again.payment.id)).toBe(true);
    expect(await db.payment.count({ where: { saleId: s.saleId } })).toBe(1);
  });

  it("rejects an amount above the remaining balance", async () => {
    const s = await lockedSale(100_000);
    await createPayment({ saleId: s.saleId, method: "CARD", amount: 60_000, approvalCode: "A1", idempotencyKey: key() }, asManager());
    await expect(
      createPayment({ saleId: s.saleId, method: "CARD", amount: 50_000, approvalCode: "A2", idempotencyKey: key() }, asManager()),
    ).rejects.toThrow(/үлдэгдлээс/);
  });

  it("TRANSFER is admin-only", async () => {
    const s = await lockedSale();
    const input = { saleId: s.saleId, method: "TRANSFER" as const, amount: 410_000, externalRef: "Golomt 123", idempotencyKey: key() };
    await expect(createPayment(input, asManager())).rejects.toThrow();
    const r = await createPayment(input, asAdmin());
    expect(r.sale.status).toBe("PAID");
  });

  it("CARD requires an approval code", async () => {
    const s = await lockedSale();
    await expect(createPayment({ saleId: s.saleId, method: "CARD", amount: 1000, approvalCode: "", idempotencyKey: key() }, asManager())).rejects.toThrow();
  });

  it("QPay without a reference fails when the API is not configured", async () => {
    setQPayProviderForTests(null);
    const s = await lockedSale();
    await expect(createPayment({ saleId: s.saleId, method: "QPAY", amount: 1000, idempotencyKey: key() }, asManager())).rejects.toThrow(/гараар/);
  });
});

describe("QPay API mode", () => {
  beforeEach(async () => {
    await db.siteSetting.create({ data: { key: "qpay", value: { mode: "api" } } });
  });

  async function startQPay(amount = 410_000) {
    const s = await lockedSale();
    const r = await createPayment({ saleId: s.saleId, method: "QPAY", amount, idempotencyKey: key() }, asManager());
    return { s, r };
  }

  it("creates an invoice → PROCESSING with QR", async () => {
    const { r } = await startQPay();
    expect(r.payment.status).toBe("PROCESSING");
    expect(r.qpay?.qrText).toBe("QR");
    expect(r.qpay?.deeplinks).toHaveLength(1);
  });

  it("invoice failure → FAILED payment and a user error", async () => {
    qpay.failCreate = true;
    const s = await lockedSale();
    await expect(createPayment({ saleId: s.saleId, method: "QPAY", amount: 1000, idempotencyKey: key() }, asManager())).rejects.toThrow(/QPay/);
    expect((await db.payment.findFirstOrThrow({ where: { saleId: s.saleId } })).status).toBe("FAILED");
  });

  it("paid=false leaves the payment PROCESSING", async () => {
    const { r } = await startQPay();
    const v = await verifyQPayPayment(r.payment.id, null);
    expect(v.payment.status).toBe("PROCESSING");
  });

  it("paid → SUCCEEDED + sale PAID; repeated/concurrent verification finalizes once", async () => {
    const { s, r } = await startQPay();
    qpay.next = { paid: true, paidAmount: 410_000, providerPaymentId: "P1", raw: {} };
    await Promise.all([verifyQPayPayment(r.payment.id, null), verifyQPayPayment(r.payment.id, null), verifyQPayPayment(r.payment.id, null)]);
    const again = await verifyQPayPayment(r.payment.id, null);
    expect(again.payment.status).toBe("SUCCEEDED");
    expect(again.sale.status).toBe("PAID");
    expect(await variantStock(s.variantId)).toEqual({ stock: 2, reserved: 0 });
    expect(await db.stockMovement.count({ where: { variantId: s.variantId, type: "SALE" } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "payment.succeeded", entityId: r.payment.id } })).toBe(1);
  });

  it("amount mismatch → stays PROCESSING with a review reason", async () => {
    const { r } = await startQPay();
    qpay.next = { paid: true, paidAmount: 100, raw: {} };
    const v = await verifyQPayPayment(r.payment.id, null);
    expect(v.payment.status).toBe("PROCESSING");
    expect(v.payment.reviewReason).toMatch(/зөрүүтэй/);
    expect(v.sale.status).toBe("PENDING_PAYMENT");
    expect(await db.auditLog.count({ where: { action: "payment.review" } })).toBe(1);
  });

  it("expired unpaid invoice → CANCELLED and the invoice is cancelled", async () => {
    const { r } = await startQPay();
    const later = new Date(Date.now() + 16 * 60 * 1000);
    const v = await verifyQPayPayment(r.payment.id, null, later);
    expect(v.payment.status).toBe("CANCELLED");
    expect(qpay.cancelled).toHaveLength(1);
  });

  it("worker poll verifies processing payments", async () => {
    const { r } = await startQPay();
    qpay.next = { paid: true, paidAmount: 410_000, raw: {} };
    expect(await pollProcessingQPayPayments()).toEqual({ checked: 1, paid: 1 });
    expect((await db.payment.findUniqueOrThrow({ where: { id: r.payment.id } })).status).toBe("SUCCEEDED");
  });

  it("pending QPay counts against the remaining balance; cancel frees it", async () => {
    const { s, r } = await startQPay(400_000);
    await expect(
      createPayment({ saleId: s.saleId, method: "CARD", amount: 20_000, approvalCode: "AB12", idempotencyKey: key() }, asManager()),
    ).rejects.toThrow(/үлдэгдлээс/);
    await cancelPayment(r.payment.id, manager.id);
    expect(await db.outboxJob.count({ where: { type: "QPAY_CANCEL_INVOICE" } })).toBe(1);
    const c = await createPayment({ saleId: s.saleId, method: "CARD", amount: 410_000, approvalCode: "AB12", idempotencyKey: key() }, asManager());
    expect(c.sale.status).toBe("PAID");
  });
});
