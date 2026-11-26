/**
 * Байршлаар ирц (PROMPT 19): ирэх/явах → WorkDay, давхар дарах, зай, AUTO_CLOSE + flagged, менежерийн засвар давуу.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { setWorkDay } from "@/server/modules/payroll/attendance";
import { toDbDate } from "@/server/modules/payroll/dates";
import { makeUser, resetDb } from "../../../../tests/db-helpers";
import { autoCloseOpenSessions, dayAttendance, myToday, punch, purgeOldCoordinates } from "./service";

const SALON = { lat: 47.918, lng: 106.917 };
const near = { lat: SALON.lat + 30 / 111_195, lng: SALON.lng, accuracyM: 12 };
const far = { lat: SALON.lat + 400 / 111_195, lng: SALON.lng, accuracyM: 12 };
const DAY = "2026-11-24"; // Мягмар
const at = (hm: string, day = DAY) => new Date(`${day}T${hm}:00+08:00`);

let staff: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  await db.branch.updateMany({ data: { latitude: SALON.lat, longitude: SALON.lng, geoRadiusM: 100, allowedIps: [] } });
  staff = await makeUser("STAFF");
});

const workDay = () => db.workDay.findUnique({ where: { staffId_date: { staffId: staff.id, date: toDbDate(DAY) } } });

describe("Ирлээ / Явлаа", () => {
  it("10:00 → 18:30: WorkDay WORKED 8.5 цаг (fromEvents)", async () => {
    await punch("CHECK_IN", staff.id, near, null, at("10:00"));
    expect(await workDay()).toBeNull();
    await punch("CHECK_OUT", staff.id, near, null, at("18:30"));
    expect(await workDay()).toMatchObject({ status: "WORKED", hours: 8.5, fromEvents: true });
  });

  it("хоёр сесс 10–13, 14–19 → 8 цаг", async () => {
    await punch("CHECK_IN", staff.id, near, null, at("10:00"));
    await punch("CHECK_OUT", staff.id, near, null, at("13:00"));
    await punch("CHECK_IN", staff.id, near, null, at("14:00"));
    await punch("CHECK_OUT", staff.id, near, null, at("19:00"));
    expect((await workDay())!.hours).toBe(8);
  });

  it("зайнаас гадуур → бүртгэхгүй; 1 минутад давхар → татгалзана; төлөвийн дараалал", async () => {
    await expect(punch("CHECK_IN", staff.id, far, null, at("10:00"))).rejects.toThrow(/~400 м зайтай/);
    expect(await db.attendanceEvent.count()).toBe(0);
    await expect(punch("CHECK_OUT", staff.id, near, null, at("10:00"))).rejects.toThrow(/Ирлээ/);
    await punch("CHECK_IN", staff.id, near, null, at("10:00"));
    await expect(punch("CHECK_OUT", staff.id, near, null, new Date(at("10:00").getTime() + 30_000))).rejects.toThrow(/1 минутын/);
    await expect(punch("CHECK_IN", staff.id, near, null, at("10:05"))).rejects.toThrow(/аль хэдийн/);
  });

  it("нарийвчлал муу → бүртгэнэ, flagged", async () => {
    const r = await punch("CHECK_IN", staff.id, { ...near, accuracyM: 220 }, null, at("10:00"));
    expect(r.flagged).toBe(true);
  });

  it("явлаа дараагүй → хуваарийн дуусах цагаар AUTO_CLOSE + flagged; менежерт харагдана", async () => {
    await db.staffSchedule.create({ data: { staffId: staff.id, weekday: 2, startTime: "10:00", endTime: "19:00" } });
    await punch("CHECK_IN", staff.id, near, null, at("10:00"));
    expect(await autoCloseOpenSessions(at("18:00"))).toBe(0);
    expect(await autoCloseOpenSessions(at("19:05"))).toBe(1);
    const close = await db.attendanceEvent.findFirstOrThrow({ where: { source: "AUTO_CLOSE" } });
    expect(close).toMatchObject({ type: "CHECK_OUT", flagged: true, at: at("19:00") });
    expect((await workDay())!.hours).toBe(9);
    const [row] = (await dayAttendance(DAY, at("20:00"))).filter((r) => r.id === staff.id);
    expect(row).toMatchObject({ missingCheckout: true, sessions: [{ in: "10:00", out: "19:00" }] });
    expect(await autoCloseOpenSessions(at("19:10"))).toBe(0);
  });

  it("AUTO_CLOSE давхардалгүй: зэрэг 3 дуудлага → нэг л мөр; дараагийн өдөр «Ирлээ» дарахад өмнөхийг хаана", async () => {
    await db.staffSchedule.create({ data: { staffId: staff.id, weekday: 2, startTime: "10:00", endTime: "19:00" } });
    await punch("CHECK_IN", staff.id, near, null, at("10:00"));
    const r = await Promise.all([autoCloseOpenSessions(at("19:30")), autoCloseOpenSessions(at("19:30")), autoCloseOpenSessions(at("19:30"))]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await db.attendanceEvent.count({ where: { source: "AUTO_CLOSE" } })).toBe(1);

    // Өмнөх өдөр нээлттэй үлдсэн → маргааш «Ирлээ» дарахад эхлээд хаагдана
    await punch("CHECK_IN", staff.id, near, null, at("10:00", "2026-11-25"));
    await punch("CHECK_IN", staff.id, near, null, at("10:00", "2026-11-26"));
    expect(await db.attendanceEvent.count({ where: { source: "AUTO_CLOSE" } })).toBe(2);
    expect(await db.workDay.findUnique({ where: { staffId_date: { staffId: staff.id, date: toDbDate("2026-11-25") } } })).toMatchObject({ hours: 14, fromEvents: true }); // Лхагва хуваарьгүй → өдрийн эцэст (23:59)
  });

  it("менежерийн гар засвар GEO-г дарна", async () => {
    const manager = await makeUser("MANAGER");
    await punch("CHECK_IN", staff.id, near, null, at("10:00"));
    await punch("CHECK_OUT", staff.id, near, null, at("18:00"));
    await setWorkDay({ staffId: staff.id, date: DAY, status: "WORKED", hours: 6, note: "Эрт явсан" }, manager.id); // service түвшин (эрхийг action шалгана)
    expect(await workDay()).toMatchObject({ hours: 6, fromEvents: false });
    await punch("CHECK_IN", staff.id, near, null, at("19:00"));
    await punch("CHECK_OUT", staff.id, near, null, at("20:00"));
    expect(await workDay()).toMatchObject({ hours: 6, fromEvents: false });
  });

  it("өнөөдрийн төлөв; 90 хоногоос хуучин координат устна (зай үлдэнэ)", async () => {
    const now = new Date();
    await punch("CHECK_IN", staff.id, near, null, now);
    expect(await myToday(staff.id, new Date(now.getTime() + 3 * 3_600_000))).toMatchObject({ working: true, minutes: 180 });
    expect(await purgeOldCoordinates(new Date(now.getTime() + 91 * 86_400_000))).toBe(1);
    expect(await db.attendanceEvent.findFirstOrThrow()).toMatchObject({ lat: null, lng: null, distanceM: 30 });
  });
});
