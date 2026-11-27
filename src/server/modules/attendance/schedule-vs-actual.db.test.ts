/**
 * PROMPT 27 §5: хуваарьтай өдөр ирээгүй = «Тасалсан», хоцролт хуваарийн эхлэхээс, чөлөөтэй өдөр тасалсан биш.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { makeUser, resetDb } from "../../../../tests/db-helpers";
import { dayAttendance, scheduleVsActual } from "./service";

const SALON = { lat: 47.918, lng: 106.917 };
const at = (day: string, hm: string) => new Date(`${day}T${hm}:00+08:00`);
// 2026-11-23 Даваа … 2026-11-27 Баасан
const MON = "2026-11-23", TUE = "2026-11-24", WED = "2026-11-25", THU = "2026-11-26";

let staff: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  await db.branch.updateMany({ data: { latitude: SALON.lat, longitude: SALON.lng, geoRadiusM: 100, allowedIps: [] } });
  staff = await makeUser("STAFF");
  // Да–Лх 10:00–19:00
  await db.staffSchedule.createMany({ data: [1, 2, 3].map((weekday) => ({ staffId: staff.id, weekday, startTime: "10:00", endTime: "19:00" })) });
});

describe("Хуваарь vs бодит", () => {
  it("Да цагтаа, Мя 25 мин хоцорсон, Лх тасалсан, Пү хуваарьгүй", async () => {
    const branch = await db.branch.findFirstOrThrow({ select: { id: true } });
    const ev = (type: "CHECK_IN" | "CHECK_OUT", d: Date) => ({ staffId: staff.id, branchId: branch.id, type, at: d, source: "GEO" as const });
    await db.attendanceEvent.createMany({
      data: [ev("CHECK_IN", at(MON, "09:58")), ev("CHECK_OUT", at(MON, "19:00")), ev("CHECK_IN", at(TUE, "10:25")), ev("CHECK_OUT", at(TUE, "19:00"))],
    });

    const [r] = (await scheduleVsActual(MON, THU, at("2026-11-27", "12:00"))).filter((x) => x.id === staff.id);
    expect(r).toMatchObject({ scheduled: 3, came: 2, late: 1, lateMin: 25, absent: 1, leave: 0 });
    expect(r!.days.map((d) => d.state)).toEqual(["ON_TIME", "LATE", "ABSENT", "OFF"]);

    const day = (await dayAttendance(WED, at("2026-11-27", "12:00"))).find((x) => x.id === staff.id)!;
    expect(day.state).toBe("ABSENT");
  });

  it("чөлөөтэй өдөр — «Чөлөөтэй», тасалсанд тоологдохгүй", async () => {
    await db.staffTimeOff.create({ data: { staffId: staff.id, startsAt: at(WED, "00:00"), endsAt: at(THU, "00:00"), reason: "SICK" } });
    const [r] = (await scheduleVsActual(WED, WED, at("2026-11-27", "12:00"))).filter((x) => x.id === staff.id);
    expect(r).toMatchObject({ absent: 0, leave: 1 });
  });

  it("өнөөдөр хуваарь дуусаагүй бол «Ирээгүй байна»", async () => {
    const day = (await dayAttendance(WED, at(WED, "11:00"))).find((x) => x.id === staff.id)!;
    expect(day.state).toBe("NOT_YET");
  });
});
