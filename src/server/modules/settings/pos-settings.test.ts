import { describe, expect, it } from "vitest";
import { posSettingsSchema, qpaySettingsSchema, taxSettingsSchema } from "./schema";

describe("POS settings defaults", () => {
  it("falls back to safe defaults when missing or invalid", () => {
    expect(posSettingsSchema.parse({})).toEqual({ maxManagerDiscountPercent: 10, allowNegativeStock: false, staleLockMinutes: 30, shiftDifferenceThreshold: 5000, cashShiftsEnabled: false });
    expect(taxSettingsSchema.parse({ vatRateBp: "10%" })).toEqual({ vatIncluded: true, vatRateBp: 1000 });
    expect(qpaySettingsSchema.parse({ mode: "something" })).toMatchObject({ mode: "manual", defaultAccount: "A", accounts: { A: { enabled: true }, B: { enabled: false } } });
  });
  it("keeps valid values", () => {
    expect(posSettingsSchema.parse({ maxManagerDiscountPercent: 15, allowNegativeStock: true, staleLockMinutes: 45 }).maxManagerDiscountPercent).toBe(15);
  });
});

describe("booking settings", () => {
  it("defaults: Mon–Sat 10–20, Sunday closed, 15 min slots", async () => {
    const { bookingSettingsSchema } = await import("./schema");
    const s = bookingSettingsSchema.parse({});
    expect(s.hours["0"]).toEqual([]);
    expect(s.hours["1"]).toEqual([{ start: "10:00", end: "20:00" }]);
    expect(s.slotMinutes).toBe(15);
    expect(bookingSettingsSchema.parse({ slotMinutes: 7 }).slotMinutes).toBe(15);
    // Зарим гариг дутуу хадгалагдсан ч бусад нь default руу унахгүй
    expect(bookingSettingsSchema.parse({ hours: { "3": [{ start: "00:00", end: "24:00" }] } }).hours["3"]).toEqual([{ start: "00:00", end: "24:00" }]);
  });
});
