import { describe, expect, it } from "vitest";
import { allocate, discountAmount, exceedsDiscountLimit, priceSale, vatOf } from "./pricing";

const VAT = { vatIncluded: true, vatRateBp: 1000 };

describe("priceSale — spec example", () => {
  it("Facial 250,000 + Serum 180,000, sale discount 20,000 → 11,628 + 8,372, total 410,000", () => {
    const r = priceSale({
      ...VAT,
      lines: [
        { key: "facial", unitPrice: 250_000, qty: 1 },
        { key: "serum", unitPrice: 180_000, qty: 1 },
      ],
      saleDiscount: { type: "AMOUNT", value: 20_000 },
    });
    expect(r.lines.map((l) => l.allocatedSaleDiscount)).toEqual([11_628, 8_372]);
    expect(r.lines.map((l) => l.lineTotal)).toEqual([238_372, 171_628]);
    expect(r.subtotal).toBe(430_000);
    expect(r.saleDiscount).toBe(20_000);
    expect(r.total).toBe(410_000);
    // НӨАТ багтсан: мөр бүрт round(lineTotal × 10/110)
    expect(r.lines.map((l) => l.vatAmount)).toEqual([21_670, 15_603]);
    expect(r.vatTotal).toBe(37_273);
  });
});

describe("discountAmount", () => {
  it("converts percent (basis points) to money and clamps to the base", () => {
    expect(discountAmount({ type: "PERCENT", bp: 1000 }, 180_000)).toBe(18_000);
    expect(discountAmount({ type: "PERCENT", bp: 333 }, 100_000)).toBe(3_330);
    expect(discountAmount({ type: "AMOUNT", value: 500_000 }, 180_000)).toBe(180_000);
    expect(discountAmount(null, 1)).toBe(0);
  });
  it("rejects negatives, fractions and >100%", () => {
    expect(() => discountAmount({ type: "AMOUNT", value: -1 }, 10)).toThrow();
    expect(() => discountAmount({ type: "AMOUNT", value: 1.5 }, 10)).toThrow();
    expect(() => discountAmount({ type: "PERCENT", bp: 10_001 }, 10)).toThrow();
  });
});

describe("allocate", () => {
  it("always sums exactly to the amount", () => {
    const cases: [number, number[]][] = [
      [20_000, [250_000, 180_000]],
      [1, [3, 3, 3]],
      [10_000, [33_333, 33_333, 33_334]],
      [99_999, [1, 2, 3, 4, 5, 100_000]],
      [7, [1, 1, 1, 1, 1, 1, 1, 1]],
    ];
    for (const [amount, bases] of cases) {
      const out = allocate(amount, bases);
      expect(out.reduce((a, b) => a + b, 0)).toBe(amount);
      out.forEach((v, i) => {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(bases[i]!);
      });
    }
  });

  it("never pushes a line below zero when the remainder exceeds the largest line", () => {
    // naive "remainder → largest line" would give [2,0,0] on bases of 1
    expect(allocate(2, [1, 1, 1])).toEqual([1, 1, 0]);
  });

  it("gives the remainder to the largest line first", () => {
    expect(allocate(1, [100, 300, 200])).toEqual([0, 1, 0]);
  });

  it("caps at the total and handles empty / zero bases", () => {
    expect(allocate(500, [100, 100])).toEqual([100, 100]);
    expect(allocate(10, [0, 0])).toEqual([0, 0]);
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
  });
});

describe("priceSale — line discounts, qty, VAT excluded", () => {
  it("applies line discounts before allocating the sale discount", () => {
    const r = priceSale({
      ...VAT,
      lines: [
        { key: "a", unitPrice: 100_000, qty: 2, lineDiscount: { type: "PERCENT", bp: 1000 } }, // 200k − 20k
        { key: "b", unitPrice: 50_000, qty: 1, lineDiscount: { type: "AMOUNT", value: 5_000 } }, // 50k − 5k
      ],
      saleDiscount: { type: "AMOUNT", value: 10_000 },
    });
    expect(r.lineDiscountTotal).toBe(25_000);
    expect(r.lines.map((l) => l.allocatedSaleDiscount)).toEqual([8_000, 2_000]);
    expect(r.total).toBe(215_000);
    expect(r.discountBp).toBe(1400); // 35k / 250k = 14%
  });

  it("adds VAT on top when prices exclude VAT", () => {
    const r = priceSale({ vatIncluded: false, vatRateBp: 1000, lines: [{ key: "a", unitPrice: 100_000, qty: 1 }] });
    expect(r.vatTotal).toBe(10_000);
    expect(r.total).toBe(110_000);
  });

  it("rejects bad quantities and prices", () => {
    expect(() => priceSale({ ...VAT, lines: [{ key: "a", unitPrice: 1, qty: 0 }] })).toThrow();
    expect(() => priceSale({ ...VAT, lines: [{ key: "a", unitPrice: -1, qty: 1 }] })).toThrow();
  });

  it("lineTotal is never negative even with 100% discounts", () => {
    const r = priceSale({
      ...VAT,
      lines: [{ key: "a", unitPrice: 1_000, qty: 1, lineDiscount: { type: "PERCENT", bp: 10_000 } }],
      saleDiscount: { type: "AMOUNT", value: 5_000 },
    });
    expect(r.lines[0]!.lineTotal).toBe(0);
    expect(r.saleDiscount).toBe(0);
    expect(r.total).toBe(0);
  });
});

describe("vatOf / exceedsDiscountLimit", () => {
  it("vat included = 10/110", () => {
    expect(vatOf(110_000, 1000, true)).toBe(10_000);
    expect(vatOf(0, 1000, true)).toBe(0);
  });

  it("limit is inclusive: exactly 10% is allowed, above is not", () => {
    expect(exceedsDiscountLimit({ subtotal: 100_000, lineDiscountTotal: 5_000, saleDiscount: 5_000 }, 10)).toBe(false);
    expect(exceedsDiscountLimit({ subtotal: 100_000, lineDiscountTotal: 5_000, saleDiscount: 5_001 }, 10)).toBe(true);
    expect(exceedsDiscountLimit({ subtotal: 0, lineDiscountTotal: 0, saleDiscount: 0 }, 10)).toBe(false);
  });
});
