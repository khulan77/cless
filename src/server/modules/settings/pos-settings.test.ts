import { describe, expect, it } from "vitest";
import { posSettingsSchema, qpaySettingsSchema, taxSettingsSchema } from "./schema";

describe("POS settings defaults", () => {
  it("falls back to safe defaults when missing or invalid", () => {
    expect(posSettingsSchema.parse({})).toEqual({ maxManagerDiscountPercent: 10, allowNegativeStock: false, staleLockMinutes: 30 });
    expect(taxSettingsSchema.parse({ vatRateBp: "10%" })).toEqual({ vatIncluded: true, vatRateBp: 1000 });
    expect(qpaySettingsSchema.parse({ mode: "something" })).toEqual({ mode: "manual" });
  });
  it("keeps valid values", () => {
    expect(posSettingsSchema.parse({ maxManagerDiscountPercent: 15, allowNegativeStock: true, staleLockMinutes: 45 }).maxManagerDiscountPercent).toBe(15);
  });
});
