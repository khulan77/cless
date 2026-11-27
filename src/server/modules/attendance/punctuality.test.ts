import { describe, expect, it } from "vitest";
import { evaluateDay } from "./punctuality";

const at = (hm: string) => new Date(`2026-11-24T${hm}:00+08:00`);
const sched = { scheduledStart: at("10:00"), scheduledEnd: at("19:00") };

describe("evaluateDay — хуваарь vs бодит", () => {
  it("цагтаа / хоцорсон минут", () => {
    expect(evaluateDay({ ...sched, firstIn: at("09:55"), onLeave: false, now: at("20:00") })).toEqual({ state: "ON_TIME", lateMin: 0 });
    expect(evaluateDay({ ...sched, firstIn: at("10:00"), onLeave: false, now: at("20:00") })).toEqual({ state: "ON_TIME", lateMin: 0 });
    expect(evaluateDay({ ...sched, firstIn: at("10:17"), onLeave: false, now: at("20:00") })).toEqual({ state: "LATE", lateMin: 17 });
  });
  it("хуваарьтай, ирээгүй → хуваарь дуусахаас өмнө «Ирээгүй байна», дараа нь «Тасалсан»", () => {
    expect(evaluateDay({ ...sched, firstIn: null, onLeave: false, now: at("12:00") }).state).toBe("NOT_YET");
    expect(evaluateDay({ ...sched, firstIn: null, onLeave: false, now: at("19:00") }).state).toBe("ABSENT");
  });
  it("чөлөөтэй → тасалсанд тооцохгүй", () => {
    expect(evaluateDay({ ...sched, firstIn: null, onLeave: true, now: at("20:00") }).state).toBe("LEAVE");
  });
  it("хуваарьгүй өдөр: амралт / хуваарьгүй ирсэн", () => {
    expect(evaluateDay({ scheduledStart: null, scheduledEnd: null, firstIn: null, onLeave: false, now: at("20:00") }).state).toBe("OFF");
    expect(evaluateDay({ scheduledStart: null, scheduledEnd: null, firstIn: at("11:00"), onLeave: false, now: at("20:00") }).state).toBe("EXTRA");
  });
});
