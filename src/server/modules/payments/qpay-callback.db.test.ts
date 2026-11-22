import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { checkout } from "@/server/modules/sales/service";
import { makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { setQPayProviderForTests } from "./providers/qpay";
import { signPaymentId } from "./providers/qpay/signature";
import type { QPayProvider } from "./providers/qpay/types";
import { createPayment } from "./service";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
const { GET, POST } = await import("@/app/api/qpay/callback/route");

const SECRET = "test-callback-secret";
let paid = false;
const provider: QPayProvider = {
  createInvoice: async (p) => ({ invoiceId: `inv_${p.paymentId}`, qrText: "QR", deeplinks: [], raw: {} }),
  checkPayment: async () => (paid ? { paid: true, paidAmount: 50_000, raw: {} } : { paid: false, paidAmount: 0, raw: {} }),
  cancelInvoice: async () => undefined,
};

beforeAll(() => {
  process.env.QPAY_CALLBACK_SECRET = SECRET;
  setQPayProviderForTests(provider);
});
afterAll(() => {
  delete process.env.QPAY_CALLBACK_SECRET;
  setQPayProviderForTests(null);
});

let paymentId: string;
let saleId: string;
beforeEach(async () => {
  await resetDb();
  paid = false;
  const m = await makeUser("MANAGER");
  await db.siteSetting.create({ data: { key: "qpay", value: { mode: "api" } } });
  const v = await makeVariant({ price: 50_000, stock: 1 });
  const s = await checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, { id: m.id, role: m.role });
  saleId = s.saleId;
  const p = await createPayment({ saleId, method: "QPAY", amount: 50_000, idempotencyKey: crypto.randomUUID() }, { id: m.id, role: m.role });
  paymentId = p.payment.id;
});

const req = (pid: string, sig: string, method = "GET", body?: string) =>
  new NextRequest(`http://localhost/api/qpay/callback?pid=${pid}&sig=${sig}`, { method, body });

describe("QPay callback route", () => {
  it("rejects a bad signature with 401 and changes nothing", async () => {
    paid = true;
    const res = await GET(req(paymentId, "0".repeat(64)));
    expect(res.status).toBe(401);
    expect((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("PROCESSING");
  });

  it("ignores the body; unpaid check leaves PROCESSING", async () => {
    const res = await POST(req(paymentId, signPaymentId(paymentId, SECRET), "POST", JSON.stringify({ payment_status: "PAID" })));
    expect(res.status).toBe(200);
    expect((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("PROCESSING");
  });

  it("paid → SUCCEEDED + sale PAID; a second callback is a no-op", async () => {
    paid = true;
    const sig = signPaymentId(paymentId, SECRET);
    expect((await GET(req(paymentId, sig))).status).toBe(200);
    expect((await GET(req(paymentId, sig))).status).toBe(200);
    expect((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("SUCCEEDED");
    expect((await db.sale.findUniqueOrThrow({ where: { id: saleId } })).status).toBe("PAID");
    expect(await db.payment.count({ where: { saleId, status: "SUCCEEDED" } })).toBe(1);
  });
});
