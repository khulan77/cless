import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createPayment } from "@/server/modules/payments/service";
import { createRefund } from "@/server/modules/refunds/service";
import { checkout } from "@/server/modules/sales/service";
import { makeCustomer, makeService, makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { customerHistory, listCustomersRanked } from "./history";

let admin: Awaited<ReturnType<typeof makeUser>>;
let staff: Awaited<ReturnType<typeof makeUser>>;
const asAdmin = () => ({ id: admin.id, role: admin.role });

beforeEach(async () => {
  await resetDb();
  admin = await makeUser("ADMIN");
  staff = await makeUser("STAFF");
});

async function buy(customerId: string, items: Parameters<typeof checkout>[0]["items"]) {
  const r = await checkout({ customerId, items }, asAdmin());
  await createPayment({ saleId: r.saleId, method: "CARD", amount: r.total, approvalCode: "AB12", idempotencyKey: crypto.randomUUID() }, asAdmin());
  return { ...r, items: await db.saleItem.findMany({ where: { saleId: r.saleId }, orderBy: { sortOrder: "asc" } }) };
}

describe("customer history and ranking (A7)", () => {
  it("amounts are net of refunds; product rows carry SKU/barcode and who sold; ranked by total", async () => {
    const serum = await makeVariant({ price: 60_000, stock: 10 });
    await db.variant.update({ where: { id: serum.id }, data: { barcode: "4600000000777" } });
    const facial = await makeService({ price: 250_000, name: "Нүүрний эмчилгээ" });
    const big = await makeCustomer();
    const small = await db.customer.update({ where: { id: (await makeCustomer()).id }, data: { phone: "88112233" } });
    await makeCustomer(); // never bought

    const s1 = await buy(big.id, [
      { kind: "PRODUCT", variantId: serum.id, qty: 3 },
      { kind: "SERVICE", serviceId: facial.id, qty: 1, staffId: staff.id },
    ]);
    // 1 of 3 serums returned
    await createRefund({ saleId: s1.saleId, items: [{ saleItemId: s1.items[0]!.id, qty: 1 }], reason: "Харшил", method: "CARD", restock: true }, admin.id);
    await buy(small.id, [{ kind: "PRODUCT", variantId: serum.id, qty: 1 }]);

    const h = await customerHistory(big.id);
    expect(h.totals).toEqual({ product: 120_000, service: 250_000, total: 370_000 });
    // Sold together with the facial → attributed to the beautician, not the cashier (attribution.ts)
    expect(h.products).toEqual([expect.objectContaining({ barcode: "4600000000777", qty: 2, amount: 120_000, staff: staff.name })]);
    expect(h.services).toEqual([expect.objectContaining({ service: "Нүүрний эмчилгээ", staff: staff.name, amount: 250_000, status: "SOLD" })]);

    const ranked = await listCustomersRanked();
    expect(ranked.rows.map((r) => r.id).slice(0, 2)).toEqual([big.id, small.id]);
    expect(ranked.rows[0]).toMatchObject({ total: 370_000, product: 120_000, service: 250_000, visits: 1 });
    expect(ranked.rows[0]!.lastVisit).toBeInstanceOf(Date);
    expect(ranked.rows[2]).toMatchObject({ total: 0, visits: 0, lastVisit: null });
    // Other columns and directions
    expect((await listCustomersRanked({ sort: "total", dir: "asc" })).rows.at(-1)!.id).toBe(big.id);
    expect((await listCustomersRanked({ sort: "product" })).rows[0]!.id).toBe(big.id);
    expect((await listCustomersRanked({ sort: "bogus" })).sort).toBe("total");
    // Search keeps working with the ranking
    expect((await listCustomersRanked({ q: "8811 22" })).rows.map((r) => r.id)).toEqual([small.id]);
  });
});
