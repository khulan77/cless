import { describe, expect, it } from "vitest";
import { change, dayCount, presetRange, previousRange, rangeFromParams } from "./definitions";

describe("report ranges", () => {
  const today = "2026-11-23";
  it("presets", () => {
    expect(presetRange("today", today)).toEqual({ from: today, to: today });
    expect(presetRange("week", today)).toEqual({ from: "2026-11-17", to: today });
    expect(presetRange("month", today)).toEqual({ from: "2026-11-01", to: today });
    expect(presetRange("lastMonth", today)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(presetRange("lastMonth", "2026-03-05")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("URL params: default month, swaps reversed dates, caps at ~1 year, recognises presets", () => {
    expect(rangeFromParams({}, today)).toEqual({ range: { from: "2026-11-01", to: today }, preset: "month" });
    expect(rangeFromParams({ from: "2026-11-10", to: "2026-11-01" }, today).range).toEqual({ from: "2026-11-01", to: "2026-11-10" });
    expect(rangeFromParams({ from: "2026-11-17", to: today }, today).preset).toBe("week");
    expect(dayCount(rangeFromParams({ from: "2020-01-01", to: today }, today).range)).toBe(370);
    expect(rangeFromParams({ from: "x", to: "y" }, today).preset).toBe("month");
  });
  it("previous period has the same length", () => {
    expect(previousRange({ from: "2026-11-01", to: "2026-11-30" })).toEqual({ from: "2026-10-02", to: "2026-10-31" });
    expect(previousRange({ from: today, to: today })).toEqual({ from: "2026-11-22", to: "2026-11-22" });
  });
  it("change %", () => {
    expect(change(150, 100)).toBe(50);
    expect(change(50, 100)).toBe(-50);
    expect(change(0, 0)).toBe(0);
    expect(change(10, 0)).toBeNull();
  });
});
