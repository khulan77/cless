/**
 * Байршлаар ирц (PROMPT 19): "Ирлээ / Явлаа".
 *  - Цаг — СЕРВЕРИЙН (утасны цагт итгэхгүй). Байршлыг зөвхөн товч дарсан мөчид авна (арын горимд хянахгүй).
 *  - Хамгийн ойр салбараас ≤ радиус + min(нарийвчлал, 50 м) бол бүртгэнэ; нарийвчлал > 150 м эсвэл IP таарахгүй — flagged.
 *  - 1 минутад давхар дарахаас хамгаална. Өдөрт олон удаа орж гарч болно (үдийн завсарлага).
 *  - Өдрийн CHECK_IN/CHECK_OUT хосоос WorkDay (WORKED, hours — 0.25 цагаар) автоматаар (fromEvents = true).
 *    Менежер гараар засвал (fromEvents = false) тэр нь давуу — үйл явдал дарж бичихгүй.
 *  - Батлагдсан цалингийн үеийн өдөр — үйл явдал бүртгэгдэнэ, WorkDay өөрчлөгдөхгүй.
 *  - "Явлаа" дараагүй: ажлын хуваарийн дуусах цагаар (хуваарьгүй бол өдрийн эцэст) AUTO_CLOSE + flagged.
 *  - lat/lng — 90 хоногийн дараа null (зай, flag үлдэнэ).
 * Координат, IP-г log-д бүү гарга.
 */
import { createHmac } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { formatTime, ubAt, ubDateKey, ubDayRange, ubWeekday } from "@/lib/time";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { toDbDate } from "@/server/modules/payroll/dates";
import { invalidateDay, lockedPeriodFor } from "@/server/modules/payroll/locks";
import { evaluateGeo } from "./geo";
import { hoursOfDay, sessionsOf, workedMinutes } from "./sessions";

type Tx = Prisma.TransactionClient;

export const DOUBLE_PRESS_MS = 60_000;
export const COORD_RETENTION_DAYS = 90;

export const M = {
  tooSoon: "Саяхан бүртгэсэн. 1 минутын дараа дахин оролдоно уу.",
  alreadyIn: "Та аль хэдийн «Ирлээ» дарсан байна.",
  notIn: "Эхлээд «Ирлээ» дарна уу.",
  noLocation: "Салоны байршил тохируулаагүй байна. Менежерт хандана уу.",
  tooFar: (m: number) => `Та салоноос ~${m >= 1000 ? `${(m / 1000).toFixed(1)} км` : `${m} м`} зайтай байна. Салон дотроос дахин оролдоно уу.`,
} as const;

const secret = () => process.env.AUTH_SECRET || "cless-dev-attendance-secret";
const hashIp = (ip: string) => createHmac("sha256", secret()).update(`att-ip:${ip}`).digest("hex");

async function eventsOfDay(client: Tx | typeof db, staffId: string, day: string) {
  const { start, end } = ubDayRange(day);
  return client.attendanceEvent.findMany({ where: { staffId, at: { gte: start, lt: end } }, orderBy: { at: "asc" } });
}

/**
 * Тухайн өдрийн WorkDay-г үйл явдлаас дахин тооцно. Менежерийн гар засвартай эсвэл түгжигдсэн өдөр — хөндөхгүй.
 * Буцаана: шинэчилсэн эсэх.
 */
export async function recomputeDay(tx: Tx, staffId: string, day: string): Promise<boolean> {
  const where = { staffId_date: { staffId, date: toDbDate(day) } };
  const existing = await tx.workDay.findUnique({ where });
  if (existing && !existing.fromEvents) return false;
  if (await lockedPeriodFor(day)) return false;
  const events = await eventsOfDay(tx, staffId, day);
  const hours = hoursOfDay(events);
  const anyClosed = sessionsOf(events).some((s) => s.out);
  if (!anyClosed) {
    if (existing) await tx.workDay.delete({ where });
  } else {
    const data = { status: "WORKED" as const, hours, fromEvents: true, note: null, markedById: null };
    await tx.workDay.upsert({ where, create: { staffId, date: toDbDate(day), ...data }, update: data });
  }
  await invalidateDay(day, tx);
  return true;
}

export type PunchInput = { lat: number; lng: number; accuracyM: number };

/** "Ирлээ" / "Явлаа" — өөрийн ирц. Сервер: зай, давхар дарах, төлөв. */
export async function punch(type: "CHECK_IN" | "CHECK_OUT", staffId: string, pos: PunchInput, ip: string | null, now = new Date()) {
  if (![pos.lat, pos.lng, pos.accuracyM].every(Number.isFinite) || Math.abs(pos.lat) > 90 || Math.abs(pos.lng) > 180) throw new UserError("Байршил буруу байна.");
  const branches = await db.branch.findMany({ where: { isActive: true }, select: { id: true, latitude: true, longitude: true, geoRadiusM: true, allowedIps: true } });
  const v = evaluateGeo(branches, pos, ip);
  if (!v.ok) throw new UserError(v.reason === "no-branch-location" ? M.noLocation : M.tooFar(v.distanceM), undefined, v.reason === "too-far" ? "GEO_TOO_FAR" : "GEO_NO_BRANCH");

  const day = ubDateKey(now);
  return db.$transaction(async (tx) => {
    // Нэг ажилтны зэрэг дарахыг цуваа болгоно
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${staffId}`}))`;
    const last = await tx.attendanceEvent.findFirst({ where: { staffId }, orderBy: { at: "desc" } });
    if (last && now.getTime() - last.at.getTime() < DOUBLE_PRESS_MS) throw new UserError(M.tooSoon, undefined, "ATT_TOO_SOON");
    const isOpen = !!last && last.type === "CHECK_IN" && ubDateKey(last.at) === day;
    if (type === "CHECK_IN" && isOpen) throw new UserError(M.alreadyIn, undefined, "ATT_ALREADY_IN");
    if (type === "CHECK_OUT" && !isOpen) throw new UserError(M.notIn, undefined, "ATT_NOT_IN");

    const e = await tx.attendanceEvent.create({
      data: {
        staffId,
        branchId: v.branchId,
        type,
        at: now,
        lat: pos.lat,
        lng: pos.lng,
        accuracyM: Math.round(pos.accuracyM),
        distanceM: v.distanceM,
        ipHash: ip ? hashIp(ip) : null,
        source: "GEO",
        flagged: v.flagged,
        note: v.reasons.length ? v.reasons.map((r) => (r === "accuracy" ? "Байршлын нарийвчлал муу" : "Салоны Wi-Fi биш")).join(", ") : null,
        createdById: staffId,
      },
    });
    if (type === "CHECK_OUT") await recomputeDay(tx, staffId, day);
    // Координатыг audit-д бичихгүй — зай, flag л
    await audit(tx, { userId: staffId, action: type === "CHECK_IN" ? "attendance.check_in" : "attendance.check_out", entity: "AttendanceEvent", entityId: e.id, after: { distanceM: v.distanceM, flagged: v.flagged } });
    return { at: e.at, flagged: e.flagged, distanceM: v.distanceM };
  });
}

/** Ажилтны өнөөдрийн төлөв (карт) */
export async function myToday(staffId: string, now = new Date()) {
  const events = await eventsOfDay(db, staffId, ubDateKey(now));
  const sessions = sessionsOf(events);
  const open = sessions.find((s) => !s.out) ?? null;
  return {
    working: !!open,
    since: open ? formatTime(open.in) : null,
    firstIn: sessions[0] ? formatTime(sessions[0].in) : null,
    minutes: Math.round(workedMinutes(sessions, now)),
    sessions: sessions.map((s) => ({ in: formatTime(s.in), out: s.out ? formatTime(s.out) : null })),
    lastAt: events.at(-1)?.at ?? null,
  };
}

// ───────────────────────── Автоматаар хаах, хадгалалт ─────────────────────────

/** "Явлаа" дараагүй сессийг хуваарийн дуусах цагаар (хуваарьгүй бол өдрийн эцэст) хаана. Worker 5 мин тутам. */
export async function autoCloseOpenSessions(now = new Date()) {
  // Сүүлийн үйл явдал нь CHECK_IN байгаа ажилтнууд (сүүлийн 3 хоног)
  const recent = await db.attendanceEvent.findMany({
    where: { at: { gte: new Date(now.getTime() - 3 * 86_400_000) } },
    orderBy: { at: "desc" },
    distinct: ["staffId"],
    select: { staffId: true, branchId: true, type: true, at: true },
  });
  let closed = 0;
  for (const last of recent.filter((r) => r.type === "CHECK_IN")) {
    const day = ubDateKey(last.at);
    const sched = await db.staffSchedule.findFirst({ where: { staffId: last.staffId, weekday: ubWeekday(last.at) }, orderBy: { endTime: "desc" } });
    const dayEnd = new Date(ubDayRange(day).end.getTime() - 60_000);
    let closeAt = sched ? ubAt(day, sched.endTime) : dayEnd;
    if (closeAt <= last.at) closeAt = dayEnd; // хуваарийн дараа ирсэн
    if (closeAt > now) continue;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${last.staffId}`}))`;
      const still = await tx.attendanceEvent.findFirst({ where: { staffId: last.staffId }, orderBy: { at: "desc" } });
      if (!still || still.type !== "CHECK_IN" || still.at.getTime() !== last.at.getTime()) return;
      const e = await tx.attendanceEvent.create({
        data: { staffId: last.staffId, branchId: last.branchId, type: "CHECK_OUT", at: closeAt, source: "AUTO_CLOSE", flagged: true, note: "«Явлаа» дараагүй — хуваарийн дуусах цагаар хаасан" },
      });
      await recomputeDay(tx, last.staffId, day);
      await audit(tx, { userId: null, action: "attendance.auto_close", entity: "AttendanceEvent", entityId: e.id, after: { day } });
      closed++;
    });
  }
  return closed;
}

/** 90 хоногоос хуучин координатыг устгана (зай, flag үлдэнэ). Worker цаг тутам. */
export async function purgeOldCoordinates(now = new Date()) {
  const r = await db.attendanceEvent.updateMany({
    where: { at: { lt: new Date(now.getTime() - COORD_RETENTION_DAYS * 86_400_000) }, OR: [{ lat: { not: null } }, { lng: { not: null } }] },
    data: { lat: null, lng: null },
  });
  return r.count;
}

// ───────────────────────── Менежерийн харагдац ─────────────────────────

/** Өдрийн ирц: ажилтан бүрт сесс, цаг, flag, "Явлаа дараагүй" */
export async function dayAttendance(day: string, now = new Date()) {
  const { start, end } = ubDayRange(day);
  const [staff, events, workDays, schedules] = await Promise.all([
    db.user.findMany({ where: { isActive: true, role: { in: ["STAFF", "MANAGER"] } }, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, role: true } }),
    db.attendanceEvent.findMany({ where: { at: { gte: start, lt: end } }, orderBy: { at: "asc" } }),
    db.workDay.findMany({ where: { date: toDbDate(day) }, select: { staffId: true, status: true, hours: true, fromEvents: true, note: true } }),
    db.staffSchedule.findMany({ where: { weekday: ubWeekday(day) }, select: { staffId: true, startTime: true, endTime: true } }),
  ]);
  return staff.map((s) => {
    const mine = events.filter((e) => e.staffId === s.id);
    const sessions = sessionsOf(mine);
    const wd = workDays.find((w) => w.staffId === s.id) ?? null;
    const sch = schedules.filter((x) => x.staffId === s.id);
    return {
      id: s.id,
      name: s.name,
      role: s.role,
      scheduled: sch.length > 0 ? `${sch[0]!.startTime}–${sch.at(-1)!.endTime}` : null,
      sessions: sessions.map((x) => ({ in: formatTime(x.in), out: x.out ? formatTime(x.out) : null })),
      working: sessions.some((x) => !x.out) && day === ubDateKey(now),
      minutes: Math.round(workedMinutes(sessions, day === ubDateKey(now) ? now : undefined)),
      flagged: mine.filter((e) => e.flagged).map((e) => ({ at: formatTime(e.at), note: e.note, autoClosed: e.source === "AUTO_CLOSE" })),
      missingCheckout: mine.some((e) => e.source === "AUTO_CLOSE"),
      workDay: wd ? { status: wd.status, hours: wd.hours, manual: !wd.fromEvents, note: wd.note } : null,
    };
  });
}

/** Самбар: "Өнөөдөр ажил дээр: 4/6" — одоо ажиллаж буй / өнөөдөр хуваарьтай (эсвэл ирсэн) */
export async function onDutyNow(now = new Date()) {
  const rows = await dayAttendance(ubDateKey(now), now);
  const expected = rows.filter((r) => r.scheduled || r.sessions.length > 0);
  return { working: rows.filter((r) => r.working).length, expected: expected.length, missing: rows.filter((r) => r.missingCheckout).length };
}

