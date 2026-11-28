/**
 * PROMPT 29: хоёр QPay данс (A — компани, B — захирал).
 * A/B тус бүр invoice → callback → PAID; буруу acct → татгалзана; B тохируулаагүй → сонгох боломжгүй;
 * хувааж төлөх A 100,000 + B 50,000 → тайланд тусдаа.
 */
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { dailyCash } from "@/server/modules/finance/daily-cash";
import { loadReport } from "@/server/modules/reports/queries";
import { checkout } from "@/server/modules/sales/service";
import { saveQPayAccounts } from "@/server/modules/settings/admin-settings";
import { ubDateKey } from "@/lib/time";
import { makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { setQPayProviderForTests } from "./providers/qpay";
import type { QPayProvider } from "./providers/qpay/types";
import { callbackUrl, createPayment } from "./service";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
const { GET } = await import("@/app/api/qpay/callback/route");

const SECRET = "test-callback-secret";
type Mock = { paid: boolean; amount: number; created: string[]; checked: string[]; provider: QPayProvider };
function mock(prefix: string): Mock {
  const m: Mock = {
    paid: false,
    amount: 0,
    created: [] as string[],
    checked: [] as string[],
    provider: {
      createInvoice: async (p: { paymentId: string; amount: number }) => {
        m.created.push(p.paymentId);
        m.amount = p.amount;
        return { invoiceId: `${prefix}_${p.paymentId}`, qrText: "QR", deeplinks: [], raw: {} };
      },
      checkPayment: async (id: string) => {
        m.checked.push(id);
        return m.paid ? { paid: true, paidAmount: m.amount, raw: {} } : { paid: false, paidAmount: 0, raw: {} };
      },
      cancelInvoice: async () => undefined,
    },
  };
  return m;
}

let A: Mock, B: Mock;
let manager: Awaited<ReturnType<typeof makeUser>>;
const as = () => ({ id: manager.id, role: manager.role });
const key = () => crypto.randomUUID();

beforeAll(() => {
  process.env.QPAY_CALLBACK_SECRET = SECRET;
});
afterAll(() => {
  delete process.env.QPAY_CALLBACK_SECRET;
  setQPayProviderForTests(null);
});
beforeEach(async () => {
  await resetDb();
  A = mock("A");
  B = mock("B");
  setQPayProviderForTests({ A: A.provider, B: B.provider });
  manager = await makeUser("MANAGER");
  await db.siteSetting.create({
    data: { key: "qpay", value: { mode: "api", accounts: { A: { label: "Компанийн данс", enabled: true }, B: { label: "Захирлын данс", enabled: true } }, defaultAccount: "A" } },
  });
});

async function sale(price: number) {
  const v = await makeVariant({ price, stock: 5 });
  return checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, as());
}
const hit = (url: string) => GET(new NextRequest(url.replace(/^https?:\/\/[^/]+/, "http://localhost")));

describe("Хоёр QPay данс", () => {
  it("A ба B тус бүр өөрийн дансаар invoice → callback → PAID", async () => {
    for (const [acct, m] of [["A", A], ["B", B]] as const) {
      const s = await sale(50_000);
      const p = await createPayment({ saleId: s.saleId, method: "QPAY", amount: 50_000, idempotencyKey: key(), qpayAccount: acct }, as());
      expect(p.payment).toMatchObject({ status: "PROCESSING", qpayAccount: acct });
      expect(m.created).toEqual([p.payment.id]);
      m.paid = true;
      expect((await hit(callbackUrl(p.payment.id, acct))).status).toBe(200);
      expect((await db.sale.findUniqueOrThrow({ where: { id: s.saleId } })).status).toBe("PAID");
      expect(m.checked).toEqual([`${acct}_${p.payment.id}`]);
    }
    // Нэг нь нөгөөгийн provider-ийг дуудаагүй
    expect(A.created).toHaveLength(1);
    expect(B.created).toHaveLength(1);
  });

  it("сонгоогүй бол анхдагч данс (A)", async () => {
    const s = await sale(30_000);
    const p = await createPayment({ saleId: s.saleId, method: "QPAY", amount: 30_000, idempotencyKey: key() }, as());
    expect(p.payment.qpayAccount).toBe("A");
  });

  it("буруу acct-тай callback → татгалзана (B төлбөрийг A гэж)", async () => {
    const s = await sale(50_000);
    const p = await createPayment({ saleId: s.saleId, method: "QPAY", amount: 50_000, idempotencyKey: key(), qpayAccount: "B" }, as());
    B.paid = true;
    A.paid = true;
    // Хүчинтэй гарын үсэгтэй ч данс зөрүүтэй
    expect((await hit(callbackUrl(p.payment.id, "A"))).status).toBe(409);
    // acct-ийг гараар солих — гарын үсэг таарахгүй
    expect((await hit(callbackUrl(p.payment.id, "B").replace("acct=B", "acct=A"))).status).toBe(401);
    expect((await db.payment.findUniqueOrThrow({ where: { id: p.payment.id } })).status).toBe("PROCESSING");
    expect(A.checked).toEqual([]);
  });

  it("B тохируулаагүй → касс дээр сонгох боломжгүй, тохиргоонд идэвхжүүлэхгүй", async () => {
    setQPayProviderForTests({ A: A.provider });
    const s = await sale(50_000);
    await expect(createPayment({ saleId: s.saleId, method: "QPAY", amount: 50_000, idempotencyKey: key(), qpayAccount: "B" }, as())).rejects.toThrow(/тохируулаагүй/);
    expect(await db.payment.count()).toBe(0);
    await expect(
      saveQPayAccounts({ accounts: { A: { label: "Компанийн данс", enabled: true }, B: { label: "Захирлын данс", enabled: true } }, defaultAccount: "A" }, manager.id),
    ).rejects.toThrow(/QPAY_B_/);
  });

  it("хувааж төлөх: A 100,000 + B 50,000 → тайлан, өдрийн кассад тусдаа", async () => {
    await db.siteSetting.update({ where: { key: "qpay" }, data: { value: { mode: "manual", accounts: { A: { label: "Компанийн данс", enabled: true }, B: { label: "Захирлын данс", enabled: true } }, defaultAccount: "A" } } });
    const s = await sale(150_000);
    await createPayment({ saleId: s.saleId, method: "QPAY", amount: 100_000, idempotencyKey: key(), externalRef: "TERM-A-1", qpayAccount: "A" }, as());
    const last = await createPayment({ saleId: s.saleId, method: "QPAY", amount: 50_000, idempotencyKey: key(), externalRef: "TERM-B-1", qpayAccount: "B" }, as());
    expect(last.sale.status).toBe("PAID");

    const today = ubDateKey();
    const r = await loadReport({ from: today, to: today }, { canCost: false });
    expect(r.payments.map(({ label, amount }) => ({ label, amount }))).toEqual([
      { label: "QPay — Компанийн данс", amount: 100_000 },
      { label: "QPay — Захирлын данс", amount: 50_000 },
    ]);
    const d = await dailyCash({ from: today, to: today });
    expect(d.totals).toMatchObject({ QPAY_A: 100_000, QPAY_B: 50_000 });
    expect(d.columns.map((c) => c.label)).toEqual(expect.arrayContaining(["QPay — Компанийн данс", "QPay — Захирлын данс"]));
  });
});
