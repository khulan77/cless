import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { openShift } from "@/server/modules/cash-shifts/service";
import { createPayment } from "@/server/modules/payments/service";
import { checkout } from "@/server/modules/sales/service";
import { makeService, makeUser, makeVariant, resetDb, variantStock } from "../../../../tests/db-helpers";
import { createRefund, refundLineAmount } from "./service";

let admin: Awaited<ReturnType<typeof makeUser>>;
let staff: Awaited<ReturnType<typeof makeUser>>;
const asAdmin = () => ({ id: admin.id, role: admin.role });

beforeEach(async () => {
  await resetDb();
  admin = await makeUser("ADMIN");
  staff = await makeUser("STAFF");
});


/** PROMPT 20: кассын ээлж анхдагчаар унтраалттай — хуучин урсгалын тестэд асаана */
async function enableShifts() {
  await db.siteSetting.upsert({ where: { key: "pos" }, create: { key: "pos", value: { cashShiftsEnabled: true } }, update: { value: { cashShiftsEnabled: true } } });
}

describe("refundLineAmount", () => {
  it("floors per unit and the last unit takes the remainder", () => {
    // 3 ширхэг, 100 000 (хөнгөлөлттэй) → 33 333 + 33 333 + 33 334
    expect(refundLineAmount(100_000, 3, 0, 1)).toBe(33_333);
    expect(refundLineAmount(100_000, 3, 1, 1)).toBe(33_333);
    expect(refundLineAmount(100_000, 3, 2, 1)).toBe(33_334);
    expect(refundLineAmount(100_000, 3, 0, 3)).toBe(100_000);
  });
});

async function paidSale() {
  const serum = await makeVariant({ price: 60_000, stock: 5 });
  const facial = await makeService({ price: 250_000 });
  const r = await checkout(
    {
      items: [
        { kind: "PRODUCT", variantId: serum.id, qty: 3 },
        { kind: "SERVICE", serviceId: facial.id, qty: 1, staffId: staff.id },
      ],
      saleDiscount: { type: "AMOUNT", value: 30_000 },
      saleDiscountReason: "VIP",
    },
    asAdmin(),
  );
  await createPayment({ saleId: r.saleId, method: "CARD", amount: r.total, approvalCode: "AB12", idempotencyKey: crypto.randomUUID() }, asAdmin());
  const items = await db.saleItem.findMany({ where: { saleId: r.saleId }, orderBy: { sortOrder: "asc" } });
  return { saleId: r.saleId, total: r.total, serumId: serum.id, product: items[0]!, service: items[1]! };
}

describe("createRefund", () => {
  it("partial restock refund → PARTIALLY_REFUNDED, stock back, refundedQty updated", async () => {
    const s = await paidSale();
    expect(await variantStock(s.serumId)).toEqual({ stock: 2, reserved: 0 });
    const r = await createRefund(
      { saleId: s.saleId, items: [{ saleItemId: s.product.id, qty: 1 }], reason: "Харшил", method: "CARD", restock: true },
      admin.id,
    );
    expect(r.status).toBe("PARTIALLY_REFUNDED");
    expect(r.refund.amount).toBe(Math.floor(s.product.lineTotal / 3));
    expect(await variantStock(s.serumId)).toEqual({ stock: 3, reserved: 0 });
    expect((await db.saleItem.findUniqueOrThrow({ where: { id: s.product.id } })).refundedQty).toBe(1);
  });

  it("damaged (no restock) keeps stock but records RETURN + ADJUSTMENT", async () => {
    const s = await paidSale();
    await createRefund({ saleId: s.saleId, items: [{ saleItemId: s.product.id, qty: 2 }], reason: "Гэмтэлтэй", method: "CARD" }, admin.id);
    expect(await variantStock(s.serumId)).toEqual({ stock: 2, reserved: 0 });
    const moves = await db.stockMovement.findMany({ where: { variantId: s.serumId, type: { in: ["RETURN", "ADJUSTMENT"] } } });
    expect(moves.map((m) => m.qty).sort()).toEqual([-2, 2]);
  });

  it("full refund across calls sums exactly to the total → REFUNDED; over-refund rejected", async () => {
    const s = await paidSale();
    for (let i = 0; i < 3; i++) {
      await createRefund({ saleId: s.saleId, items: [{ saleItemId: s.product.id, qty: 1 }], reason: "Буцаалт", method: "CARD", restock: true }, admin.id);
    }
    await expect(
      createRefund({ saleId: s.saleId, items: [{ saleItemId: s.product.id, qty: 1 }], reason: "Дахин", method: "CARD" }, admin.id),
    ).rejects.toThrow(/илүүг/);
    const last = await createRefund({ saleId: s.saleId, items: [{ saleItemId: s.service.id, qty: 1 }], reason: "Үйлчилгээ", method: "CARD" }, admin.id);
    expect(last.status).toBe("REFUNDED");
    const sale = await db.sale.findUniqueOrThrow({ where: { id: s.saleId } });
    expect(sale.refundedAmount).toBe(s.total);
  });

  it("cash refund needs an open shift with enough cash (cash shifts enabled)", async () => {
    await enableShifts();
    const s = await paidSale();
    const input = { saleId: s.saleId, items: [{ saleItemId: s.product.id, qty: 1 }], reason: "Буцаалт", method: "CASH" as const };
    await expect(createRefund(input, admin.id)).rejects.toThrow(/кассаа нээнэ/);
    await openShift({ openingCash: 10_000 }, admin.id);
    await expect(createRefund(input, admin.id)).rejects.toThrow(/хүрэлцэх/);
    expect((await db.saleItem.findUniqueOrThrow({ where: { id: s.product.id } })).refundedQty).toBe(0);
  });

  it("cannot refund an unpaid sale", async () => {
    const v = await makeVariant({ price: 1_000, stock: 1 });
    const r = await checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, asAdmin());
    const item = await db.saleItem.findFirstOrThrow({ where: { saleId: r.saleId } });
    await expect(createRefund({ saleId: r.saleId, items: [{ saleItemId: item.id, qty: 1 }], reason: "abc", method: "CARD" }, admin.id)).rejects.toThrow(
      /төлөгдсөн/,
    );
  });
});
