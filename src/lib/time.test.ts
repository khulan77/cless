import { describe, expect, it } from "vitest";
import { addDays, formatDateLabel, formatTime, parseHm, ubAt, ubDateKey, ubDayRange, ubMinuteOfDay, ubWeekday } from "./time";

describe("Ulaanbaatar business day", () => {
  it("rolls over at local midnight, not UTC midnight", () => {
    expect(ubDateKey(new Date("2026-11-30T15:59:59Z"))).toBe("2026-11-30"); // 23:59:59 УБ
    expect(ubDateKey(new Date("2026-11-30T16:00:00Z"))).toBe("2026-12-01"); // 00:00 УБ
  });
  it("day range is [00:00, 24:00) UB in UTC", () => {
    const { start, end } = ubDayRange(new Date("2026-12-01T03:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-30T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-01T16:00:00.000Z");
    expect(ubDayRange("2026-12-01").start.toISOString()).toBe("2026-11-30T16:00:00.000Z");
  });
  it("weekday is the UB weekday (UTC Monday 20:00 = UB Tuesday)", () => {
    expect(ubWeekday("2026-11-29")).toBe(0); // Ням
    expect(ubWeekday(new Date("2026-11-30T16:30:00Z"))).toBe(2); // УБ Мягмар 00:30
  });
  it("UB date + HH:MM ↔ UTC", () => {
    expect(ubAt("2026-12-01", "10:00").toISOString()).toBe("2026-12-01T02:00:00.000Z");
    expect(ubAt("2026-12-01", "00:00").toISOString()).toBe("2026-11-30T16:00:00.000Z");
    expect(ubAt("2026-12-01", "24:00").toISOString()).toBe("2026-12-01T16:00:00.000Z");
    expect(formatTime(new Date("2026-12-01T06:30:00Z"))).toBe("14:30");
    expect(ubMinuteOfDay(new Date("2026-11-30T16:15:00Z"))).toBe(15);
  });
  it("parses and labels", () => {
    expect(parseHm("09:45")).toBe(585);
    expect(() => parseHm("25:00")).toThrow();
    expect(() => parseHm("9:00")).toThrow();
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(formatDateLabel("2026-11-26")).toBe("11/26 (Пүрэв)");
  });
});
