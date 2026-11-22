import { describe, expect, it } from "vitest";
import { ubDateKey, ubDayRange } from "./ub-time";

describe("Ulaanbaatar business day", () => {
  it("rolls over at local midnight, not UTC midnight", () => {
    expect(ubDateKey(new Date("2026-11-30T15:59:59Z"))).toBe("2026-11-30"); // 23:59:59 УБ
    expect(ubDateKey(new Date("2026-11-30T16:00:00Z"))).toBe("2026-12-01"); // 00:00 УБ
  });
  it("day range is [00:00, 24:00) UB in UTC", () => {
    const { start, end } = ubDayRange(new Date("2026-12-01T03:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-30T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-01T16:00:00.000Z");
  });
});
