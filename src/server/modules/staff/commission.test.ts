import { describe, expect, it } from "vitest";
import { commissionFor, pickRule, type CommissionLine, type CommissionRuleLite } from "./commission";

const rule = (over: Partial<CommissionRuleLite>): CommissionRuleLite => ({
  id: "r",
  kind: "SERVICE",
  type: "PERCENT",
  value: 1000,
  priority: 0,
  isActive: true,
  staffId: null,
  serviceId: null,
  productId: null,
  collectionId: null,
  ...over,
});
const line = (over: Partial<CommissionLine>): CommissionLine => ({ kind: "SERVICE", staffId: "sara", serviceId: "facial", productId: null, collectionIds: [], amount: 200_000, qty: 1, ...over });

describe("commission", () => {
  it("default 10% on services, 5% on products", () => {
    const rules = [rule({ id: "s" }), rule({ id: "p", kind: "PRODUCT", value: 500 })];
    expect(commissionFor(line({}), rules)).toBe(20_000);
    expect(commissionFor(line({ kind: "PRODUCT", serviceId: null, productId: "serum", amount: 120_000, qty: 2 }), rules)).toBe(6_000);
  });

  it("the most specific rule wins; priority beats specificity; inactive/other staff ignored", () => {
    const rules = [
      rule({ id: "default" }),
      rule({ id: "facial", serviceId: "facial", value: 1500 }),
      rule({ id: "sara-facial", serviceId: "facial", staffId: "sara", value: 2000 }),
      rule({ id: "nomin", staffId: "nomin", value: 3000 }),
      rule({ id: "off", serviceId: "facial", staffId: "sara", value: 9000, isActive: false }),
    ];
    expect(pickRule(line({}), rules)?.id).toBe("sara-facial");
    expect(pickRule(line({ staffId: "bolor" }), rules)?.id).toBe("facial");
    expect(pickRule(line({ serviceId: "massage", staffId: "bolor" }), rules)?.id).toBe("default");
    expect(pickRule(line({}), [...rules, rule({ id: "promo", priority: 5, value: 500 })])?.id).toBe("promo");
  });

  it("collection rules for products; FIXED per unit; refunded-to-zero lines earn nothing", () => {
    const rules = [rule({ id: "c", kind: "PRODUCT", collectionId: "serums", type: "FIXED", value: 3_000 })];
    const serum = line({ kind: "PRODUCT", serviceId: null, productId: "x", collectionIds: ["serums"], amount: 120_000, qty: 2 });
    expect(commissionFor(serum, rules)).toBe(6_000);
    expect(commissionFor({ ...serum, collectionIds: ["masks"] }, rules)).toBe(0);
    expect(commissionFor({ ...serum, amount: 0, qty: 0 }, rules)).toBe(0);
    expect(commissionFor(line({}), [])).toBe(0);
  });
});
