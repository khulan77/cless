import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createPayment } from "@/server/modules/payments/service";
import { checkout } from "@/server/modules/sales/service";
import { makeService, makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { mySales } from "./dashboard";

beforeEach(async () => {
  await resetDb();
});

describe("Миний борлуулалт (A8)", () => {
  it("services by me + products sold with my service; commission by the rules", async () => {
    const admin = await makeUser("ADMIN");
    const as = { id: admin.id, role: admin.role };
    const sara = await makeUser("STAFF");
    const nomin = await makeUser("STAFF");
    await db.commissionRule.createMany({
      data: [
        { kind: "SERVICE", type: "PERCENT", value: 1000 },
        { kind: "PRODUCT", type: "PERCENT", value: 500 },
      ],
    });
    const facial = await makeService({ price: 200_000, name: "Нүүрний эмчилгээ" });
    const serum = await makeVariant({ price: 60_000, stock: 10, name: "SERUM" });
    const pay = async (items: Parameters<typeof checkout>[0]["items"]) => {
      const r = await checkout({ items }, as);
      await createPayment({ saleId: r.saleId, method: "CARD", amount: r.total, approvalCode: "AP1", idempotencyKey: crypto.randomUUID() }, as);
    };
    await pay([{ kind: "SERVICE", serviceId: facial.id, qty: 1, staffId: sara.id }, { kind: "PRODUCT", variantId: serum.id, qty: 2 }]);
    await pay([{ kind: "SERVICE", serviceId: facial.id, qty: 1, staffId: nomin.id }]);
    await pay([{ kind: "PRODUCT", variantId: serum.id, qty: 1 }]); // nobody's

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(new Date());
    const s = await mySales(sara.id, { from: today, to: today });
    expect(s.services).toMatchObject({ qty: 1, amount: 200_000, commission: 20_000 });
    expect(s.products).toMatchObject({ qty: 2, amount: 120_000, commission: 6_000 });
    expect(s.commission).toBe(26_000);
    const n = await mySales(nomin.id, { from: today, to: today });
    expect(n.products.qty).toBe(0);
    expect(n.services.amount).toBe(200_000);
  });
});
