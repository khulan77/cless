import { describe, expect, it } from "vitest";
import { hoursOf, periodHours, weekKey, weeklyHours } from "./hours";

describe("цаг — 7 хоногт 40", () => {
  it("7 хоногийн түлхүүр: Даваа; жилийн заагаар гарсан 7 хоног нэг бүлэг", () => {
    expect(weekKey("2026-12-28")).toBe("2026-12-28"); // Даваа
    expect(weekKey("2026-12-31")).toBe("2026-12-28");
    expect(weekKey("2027-01-03")).toBe("2026-12-28"); // Ням
    expect(weekKey("2027-01-04")).toBe("2027-01-04");
  });

  it("жилийн заагаар: 5 өдөр × 9 цаг = 45 → 5 цаг илүү; дараагийн 7 хоног тусдаа", () => {
    const days = ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01"].map((date) => ({ date, hours: 9 }));
    days.push({ date: "2027-01-04", hours: 8 });
    expect(weeklyHours(days)).toEqual([
      { week: "2026-12-28", from: "2026-12-28", to: "2027-01-01", hours: 45, overtime: 5 },
      { week: "2027-01-04", from: "2027-01-04", to: "2027-01-04", hours: 8, overtime: 0 },
    ]);
  });

  it("үеийн нийлбэр: норм = төлөвлөсөн өдөр × 8; анхдагч цаг төлвөөр", () => {
    expect(hoursOf("WORKED", null)).toBe(8);
    expect(hoursOf("HALF_DAY", undefined)).toBe(4);
    expect(hoursOf("WORKED", 10)).toBe(10);
    const r = periodHours([
      { date: "2026-11-23", hours: 10, planned: true },
      { date: "2026-11-24", hours: 10, planned: true },
      { date: "2026-11-25", hours: 10, planned: true },
      { date: "2026-11-26", hours: 10, planned: true },
      { date: "2026-11-27", hours: 4, planned: true },
      { date: "2026-11-28", hours: 0, planned: false },
    ]);
    expect(r).toMatchObject({ worked: 44, norm: 40, overtime: 4 });
  });
});
