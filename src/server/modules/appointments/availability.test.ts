import { describe, expect, it } from "vitest";
import { formatTime, ubAt } from "@/lib/time";
import { checkSlot, eligibleStaffIds, findSlots, subtract, type AvailabilityInput, type AvailabilityStaff } from "./availability";

// 2026-12-02 = Лхагва (weekday 3); 2026-12-06 = Ням
const DAY = "2026-12-02";
const at = (hm: string, date = DAY) => ubAt(date, hm);
const fullWeek = (start: string, end: string) => [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: start, endTime: end }));
const staff = (id: string, over: Partial<AvailabilityStaff> = {}): AvailabilityStaff => ({ id, schedule: fullWeek("10:00", "19:00"), timeOff: [], busy: [], ...over });

function input(over: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: DAY,
    now: new Date("2026-12-01T00:00:00Z"),
    service: { durationMin: 60, bufferMin: 0, requiresRoom: false },
    staff: [staff("a")],
    rooms: [],
    branchHours: [{ start: "10:00", end: "20:00" }],
    slotMinutes: 15,
    minLeadMinutes: 0,
    ...over,
  };
}
const times = (slots: { startsAt: Date }[]) => slots.map((s) => formatTime(s.startsAt));

describe("findSlots", () => {
  it("15-min grid inside staff hours ∩ branch hours; the service must fit before closing", () => {
    const t = times(findSlots(input()));
    expect(t[0]).toBe("10:00");
    expect(t[1]).toBe("10:15");
    expect(t.at(-1)).toBe("18:00"); // 18:00 + 60 = 19:00 (ажилтны төгсгөл)
    expect(t).not.toContain("18:15");
  });

  it("staff hours are clipped by branch hours", () => {
    const t = times(findSlots(input({ staff: [staff("a", { schedule: fullWeek("08:00", "22:00") })] })));
    expect(t[0]).toBe("10:00");
    expect(t.at(-1)).toBe("19:00"); // салбар 20:00-д хаагдана
  });

  it("break in the schedule (two intervals)", () => {
    const s = staff("a", { schedule: [{ weekday: 3, startTime: "10:00", endTime: "13:00" }, { weekday: 3, startTime: "14:00", endTime: "19:00" }] });
    const t = times(findSlots(input({ staff: [s] })));
    expect(t).toContain("12:00");
    expect(t).not.toContain("12:15"); // 13:15 хүртэл → завсарлагад орно
    expect(t).not.toContain("13:00");
    expect(t).toContain("14:00");
  });

  it("day off: no schedule for the weekday, or the branch is closed", () => {
    expect(findSlots(input({ staff: [staff("a", { schedule: [{ weekday: 1, startTime: "10:00", endTime: "19:00" }] })] }))).toEqual([]);
    expect(findSlots(input({ date: "2026-12-06", branchHours: [] }))).toEqual([]);
  });

  it("time off removes the interval", () => {
    const s = staff("a", { timeOff: [{ startsAt: at("12:00"), endsAt: at("15:00") }] });
    const t = times(findSlots(input({ staff: [s] })));
    expect(t).toContain("11:00");
    expect(t).not.toContain("11:15");
    expect(t).toContain("15:00");
  });

  it("existing appointments block until blockedUntil (buffer)", () => {
    const s = staff("a", { busy: [{ startsAt: at("11:00"), blockedUntil: at("12:10") }] });
    const t = times(findSlots(input({ staff: [s] })));
    expect(t).toContain("10:00");
    expect(t).not.toContain("10:15"); // 11:15 хүртэл → давхцана
    expect(t).not.toContain("12:00");
    expect(t).toContain("12:15"); // буфер дууссаны дараах тор
  });

  it("the new service's own buffer must fit too", () => {
    const t = times(findSlots(input({ service: { durationMin: 60, bufferMin: 15, requiresRoom: false } })));
    expect(t.at(-1)).toBe("17:45"); // 17:45 + 60 + 15 = 19:00
  });

  it("past times and min lead are skipped", () => {
    const t = times(findSlots(input({ now: at("13:07"), minLeadMinutes: 30 })));
    expect(t[0]).toBe("13:45"); // 13:37 → дараагийн тор
  });

  it("midnight boundary: UB 00:00 = UTC 16:00 the previous day", () => {
    const s = staff("a", { schedule: fullWeek("00:00", "02:00") });
    const slots = findSlots(input({ staff: [s], branchHours: [{ start: "00:00", end: "24:00" }], service: { durationMin: 60, bufferMin: 0, requiresRoom: false } }));
    expect(slots[0]!.startsAt.toISOString()).toBe("2026-12-01T16:00:00.000Z");
    expect(times(slots).at(-1)).toBe("01:00");
  });

  it("requiresRoom: needs a free room; all rooms busy → no slot", () => {
    const rooms = [
      { id: "r1", busy: [{ startsAt: at("10:00"), blockedUntil: at("12:00") }] },
      { id: "r2", busy: [{ startsAt: at("10:00"), blockedUntil: at("11:00") }] },
    ];
    const slots = findSlots(input({ service: { durationMin: 60, bufferMin: 0, requiresRoom: true }, rooms }));
    expect(times(slots)[0]).toBe("11:00");
    expect(slots[0]!.roomId).toBe("r2");
    expect(slots.find((s) => formatTime(s.startsAt) === "12:00")!.roomId).toBe("r1");
    // Өрөө бүртгэлгүй бол өрөөний логик унтарна
    expect(times(findSlots(input({ service: { durationMin: 60, bufferMin: 0, requiresRoom: true }, rooms: [] })))[0]).toBe("10:00");
  });

  it("every staff member busy → nothing; otherwise slots per staff member", () => {
    const busyAllDay = [{ startsAt: at("10:00"), blockedUntil: at("20:00") }];
    expect(findSlots(input({ staff: [staff("a", { busy: busyAllDay }), staff("b", { busy: busyAllDay })] }))).toEqual([]);
    const slots = findSlots(input({ staff: [staff("a", { busy: busyAllDay }), staff("b")] }));
    expect(new Set(slots.map((s) => s.staffId))).toEqual(new Set(["b"]));
    expect(findSlots(input({ staff: [staff("a"), staff("b")], staffId: "a" })).every((s) => s.staffId === "a")).toBe(true);
  });
});

describe("eligibleStaffIds / subtract / checkSlot", () => {
  it("empty ServiceStaff = every bookable staff member", () => {
    expect(eligibleStaffIds(["a", "b"], [])).toEqual(["a", "b"]);
    expect(eligibleStaffIds(["a", "b"], ["b", "x"])).toEqual(["b"]);
  });

  it("subtract splits intervals", () => {
    expect(subtract([{ start: 0, end: 10 }], [{ start: 3, end: 5 }])).toEqual([{ start: 0, end: 3 }, { start: 5, end: 10 }]);
  });

  it("checkSlot explains why a time is not possible", () => {
    const base = { ...input(), staffId: "a" };
    expect(checkSlot({ ...base, startsAt: at("10:00") })).toBeNull();
    expect(checkSlot({ ...base, startsAt: at("10:07") })).toBeNull(); // торонд тааруулахыг шаардахгүй
    expect(checkSlot({ ...base, startsAt: at("18:30") })).toBe("OUTSIDE_HOURS");
    expect(checkSlot({ ...base, startsAt: at("09:00") })).toBe("OUTSIDE_HOURS");
    expect(checkSlot({ ...base, now: at("12:00"), startsAt: at("11:00") })).toBe("PAST");
    expect(checkSlot({ ...base, staff: [staff("a", { timeOff: [{ startsAt: at("10:30"), endsAt: at("11:00") }] })], startsAt: at("10:00") })).toBe("TIME_OFF");
    expect(checkSlot({ ...base, staff: [staff("a", { busy: [{ startsAt: at("10:30"), blockedUntil: at("11:30") }] })], startsAt: at("10:00") })).toBe("STAFF_BUSY");
    const roomSvc = { durationMin: 60, bufferMin: 0, requiresRoom: true };
    const rooms = [{ id: "r1", busy: [{ startsAt: at("10:00"), blockedUntil: at("11:00") }] }];
    expect(checkSlot({ ...base, service: roomSvc, rooms, startsAt: at("10:00") })).toBe("ROOM_REQUIRED");
    expect(checkSlot({ ...base, service: roomSvc, rooms, roomId: "r1", startsAt: at("10:00") })).toBe("ROOM_BUSY");
    expect(checkSlot({ ...base, service: roomSvc, rooms, roomId: "r1", startsAt: at("11:00") })).toBeNull();
  });
});
