/**
 * Календарь, "Миний хуваарь", POS-ийн "Өнөөдрийн цаг", хянах самбарын уншилтууд.
 * Үйлчлүүлэгчийн утас/имэйл зөвхөн customer:contact:read эрхтэй үед сонгогдоно (DB-ээс ч уншихгүй).
 */
import type { ApptStatus, Prisma } from "@/generated/prisma/client";
import { addDays, parseHm, ubDateKey, ubDayRange, ubWeekday } from "@/lib/time";
import { db } from "@/server/db";
import { getBookingSettings } from "@/server/modules/settings/pos-settings";
import { workingIntervals } from "./availability";
import { bookableStaff } from "./repo";

const customerSelect = (canContact: boolean) =>
  ({ id: true, name: true, ...(canContact ? { phone: true, email: true } : {}) }) satisfies Prisma.CustomerSelect;

const apptSelect = (canContact: boolean) =>
  ({
    id: true,
    staffId: true,
    roomId: true,
    startsAt: true,
    endsAt: true,
    blockedUntil: true,
    extraMin: true,
    status: true,
    source: true,
    note: true,
    version: true,
    customer: { select: customerSelect(canContact) },
    service: { select: { id: true, name: true, durationMin: true, bufferMin: true } },
    room: { select: { id: true, name: true } },
    staff: { select: { name: true } },
  }) satisfies Prisma.AppointmentSelect;

export type CalendarAppt = {
  id: string;
  staffId: string;
  roomId: string | null;
  startsAt: Date;
  endsAt: Date;
  blockedUntil: Date;
  extraMin: number;
  status: ApptStatus;
  source: string;
  note: string | null;
  version: number;
  customer: { id: string; name: string; phone?: string; email?: string | null };
  service: { id: string; name: string; durationMin: number; bufferMin: number };
  room: { id: string; name: string } | null;
  staff: { name: string };
};

/** Харуулах цагийн тэнхлэг: салбарын ажлын цаг (амралтын өдөр бол 7 хоногийн хамгийн өргөн) */
function axisFor(hours: Record<string, { start: string; end: string }[] | undefined>, weekday: number) {
  const list = hours[String(weekday)]?.length ? hours[String(weekday)]! : Object.values(hours).flatMap((l) => l ?? []);
  if (!list.length) return { startMin: 10 * 60, endMin: 20 * 60 };
  return { startMin: Math.min(...list.map((i) => parseHm(i.start))), endMin: Math.max(...list.map((i) => parseHm(i.end))) };
}

/** Өдрийн харагдац: ажилтан бүр багана */
export async function dayView(date: string, opts: { canContact: boolean }) {
  const settings = await getBookingSettings();
  const weekday = ubWeekday(date);
  const { start, end } = ubDayRange(date);
  const [staff, appts, rooms] = await Promise.all([
    bookableStaff(),
    db.appointment.findMany({
      where: { startsAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      orderBy: { startsAt: "asc" },
      select: apptSelect(opts.canContact),
    }),
    db.room.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  // Bookable биш ч тухайн өдөр цагтай ажилтныг харуулна
  const extraIds = [...new Set(appts.map((a) => a.staffId))].filter((id) => !staff.some((s) => s.id === id));
  const extra = extraIds.length ? await db.user.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true, role: true } }) : [];
  const columns = [...staff, ...extra];
  const ids = columns.map((s) => s.id);
  const [schedules, timeOffs] = await Promise.all([
    db.staffSchedule.findMany({ where: { staffId: { in: ids }, weekday } }),
    db.staffTimeOff.findMany({ where: { staffId: { in: ids }, startsAt: { lt: end }, endsAt: { gt: start } } }),
  ]);
  const branchHours = settings.hours[String(weekday) as "0"] ?? [];
  return {
    date,
    slotMinutes: settings.slotMinutes,
    axis: axisFor(settings.hours, weekday),
    branchHours,
    rooms,
    cancelReasons: settings.cancelReasons,
    staff: columns.map((s) => ({
      id: s.id,
      name: s.name,
      working: workingIntervals(date, { schedule: schedules.filter((x) => x.staffId === s.id) }, branchHours).map((i) => ({ start: new Date(i.start), end: new Date(i.end) })),
      timeOff: timeOffs.filter((x) => x.staffId === s.id).map((x) => ({ start: x.startsAt, end: x.endsAt, reason: x.reason })),
    })),
    appointments: appts as CalendarAppt[],
  };
}

/** 7 хоногийн харагдац: нэг ажилтан, өдөр бүр багана */
export async function weekView(staffId: string, weekStart: string, opts: { canContact: boolean }) {
  const settings = await getBookingSettings();
  const start = ubDayRange(weekStart).start;
  const end = ubDayRange(addDays(weekStart, 6)).end;
  const [appts, schedules, timeOffs] = await Promise.all([
    db.appointment.findMany({
      where: { staffId, startsAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      orderBy: { startsAt: "asc" },
      select: apptSelect(opts.canContact),
    }),
    db.staffSchedule.findMany({ where: { staffId } }),
    db.staffTimeOff.findMany({ where: { staffId, startsAt: { lt: end }, endsAt: { gt: start } } }),
  ]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const axes = days.map((d) => axisFor(settings.hours, ubWeekday(d)));
  return {
    days: days.map((date) => {
      const branchHours = settings.hours[String(ubWeekday(date)) as "0"] ?? [];
      const range = ubDayRange(date);
      return {
        date,
        working: workingIntervals(date, { schedule: schedules }, branchHours).map((i) => ({ start: new Date(i.start), end: new Date(i.end) })),
        timeOff: timeOffs.filter((x) => x.startsAt < range.end && x.endsAt > range.start).map((x) => ({ start: x.startsAt, end: x.endsAt, reason: x.reason })),
      };
    }),
    axis: { startMin: Math.min(...axes.map((a) => a.startMin)), endMin: Math.max(...axes.map((a) => a.endMin)) },
    slotMinutes: settings.slotMinutes,
    appointments: appts as CalendarAppt[],
  };
}

/** Дэлгэрэнгүй panel: мэдээлэл, идэвхтэй Sale, түүх (AuditLog) */
export async function appointmentDetail(id: string, opts: { canContact: boolean }) {
  const appt = await db.appointment.findUnique({
    where: { id },
    select: {
      ...apptSelect(opts.canContact),
      priceSnapshot: true,
      cancelReason: true,
      cancelCategory: true,
      cancelledAt: true,
      cancelledBy: { select: { name: true } },
      createdAt: true,
      staff: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      sales: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, status: true } },
    },
  });
  if (!appt) return null;
  const history = await db.auditLog.findMany({
    where: { entity: "Appointment", entityId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, createdAt: true, after: true, user: { select: { name: true } } },
  });
  return { ...appt, history };
}

/** "Миний хуваарь": зөвхөн өөрийн цагууд, утас/имэйлгүй, өмнөх оношлогоотой */
export async function mySchedule(staffId: string, from: string, days: number) {
  const start = ubDayRange(from).start;
  const end = ubDayRange(addDays(from, days - 1)).end;
  const appts = await db.appointment.findMany({
    where: { staffId, startsAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      note: true,
      customerId: true,
      customer: { select: { name: true } },
      service: { select: { name: true } },
      room: { select: { name: true } },
    },
  });
  // Үйлчлүүлэгч бүрийн хамгийн сүүлийн оношлогоо (арьсны төрөл, тэмдэглэл)
  const customerIds = [...new Set(appts.map((a) => a.customerId))];
  const visits = customerIds.length
    ? await db.visit.findMany({
        where: { customerId: { in: customerIds }, createdAt: { lt: end } },
        orderBy: { createdAt: "desc" },
        select: { customerId: true, createdAt: true, skinType: true, diagnosisNotes: true },
      })
    : [];
  return appts.map(({ customerId, ...a }) => ({ ...a, lastVisit: visits.find((v) => v.customerId === customerId && v.createdAt < a.startsAt) ?? null }));
}

/** POS: өнөөдрийн идэвхтэй цагууд (цагаар) */
export async function todayForPos(now = new Date()) {
  const { start, end } = ubDayRange(now);
  return db.appointment.findMany({
    where: { startsAt: { gte: start, lt: end }, status: { in: ["BOOKED", "CONFIRMED", "ARRIVED"] } },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, status: true, customer: { select: { name: true } }, service: { select: { name: true } }, staff: { select: { name: true } } },
  });
}

/** Хянах самбар: өнөөдрийн тоо, дараагийн 3, ирээгүй */
export async function todayAppointmentStats(now = new Date()) {
  const { start, end } = ubDayRange(now);
  const where = { startsAt: { gte: start, lt: end } };
  const [total, noShow, next] = await Promise.all([
    db.appointment.count({ where: { ...where, status: { notIn: ["CANCELLED", "NO_SHOW"] } } }),
    db.appointment.count({ where: { ...where, status: "NO_SHOW" } }),
    db.appointment.findMany({
      where: { startsAt: { gte: now, lt: end }, status: { in: ["BOOKED", "CONFIRMED"] } },
      orderBy: { startsAt: "asc" },
      take: 3,
      select: { id: true, startsAt: true, customer: { select: { name: true } }, service: { select: { name: true } }, staff: { select: { name: true } } },
    }),
  ]);
  return { total, noShow, next, date: ubDateKey(now) };
}
