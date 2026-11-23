import { describe, expect, it } from "vitest";
import { contactWindow, inquiryReply, hoursToLines } from "./hours";

describe("hoursToLines", () => {
  it("merges consecutive days with the same hours, Monday first", () => {
    const h = { "0": [], "1": [{ start: "10:00", end: "20:00" }], "2": [{ start: "10:00", end: "20:00" }], "3": [{ start: "10:00", end: "20:00" }], "4": [{ start: "10:00", end: "20:00" }], "5": [{ start: "10:00", end: "20:00" }], "6": [{ start: "10:00", end: "20:00" }] };
    expect(hoursToLines(h)).toEqual(["Даваа–Бямба 10:00–20:00", "Ням амарна"]);
  });

  it("splits groups, keeps single days, breaks and missing days", () => {
    const wk = [{ start: "10:00", end: "19:00" }];
    const h = { "1": wk, "2": wk, "3": wk, "4": wk, "5": wk, "6": [{ start: "11:00", end: "17:00" }], "0": [{ start: "11:00", end: "14:00" }, { start: "15:00", end: "18:00" }] };
    expect(hoursToLines(h)).toEqual(["Даваа–Баасан 10:00–19:00", "Бямба 11:00–17:00", "Ням 11:00–14:00, 15:00–18:00"]);
    expect(hoursToLines({})).toEqual(["Даваа–Ням амарна"]);
  });
});

describe("contactWindow", () => {
  const week = { "0": [], "1": [{ start: "10:00", end: "20:00" }], "2": [{ start: "10:00", end: "20:00" }], "3": [{ start: "10:00", end: "20:00" }], "4": [{ start: "10:00", end: "20:00" }], "5": [{ start: "10:00", end: "20:00" }], "6": [{ start: "10:00", end: "20:00" }] };
  // 2026-11-24 = Tuesday; UB = UTC+8
  it("open during hours (≥30 min left)", () => {
    expect(contactWindow(week, new Date("2026-11-24T04:00:00Z"))).toEqual({ kind: "open" });
    expect(inquiryReply({ kind: "open" })).toContain("1 цагийн дотор");
  });
  it("before opening → today; late evening → tomorrow; Saturday night → Monday", () => {
    expect(contactWindow(week, new Date("2026-11-24T00:30:00Z"))).toMatchObject({ kind: "later", daysAhead: 0 }); // 08:30
    expect(contactWindow(week, new Date("2026-11-24T11:45:00Z"))).toMatchObject({ kind: "later", daysAhead: 1 }); // 19:45
    const sat = contactWindow(week, new Date("2026-11-28T14:00:00Z"));
    expect(sat).toMatchObject({ kind: "later", daysAhead: 2, weekday: 1 });
    expect(inquiryReply(sat)).toBe("Хүсэлт хүлээн авлаа. Даваа гарагт ажлын цагаар холбогдоно.");
  });
});
