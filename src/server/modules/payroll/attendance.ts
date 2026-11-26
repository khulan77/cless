/**
 * Ирц (PROMPT 14 §2). Менежер тэмдэглэнэ; тэмдэглээгүй өдөр ажлын хуваариас тооцоологдоно
 * (хуваарийн өдөр → WORKED, үгүй / нийтийн амралт → OFF) — DB-д бичихгүй. Өөрчилсөн өдөр л WorkDay мөр үүснэ;
 * анхдагч руугаа буцаавал мөр устна. Батлагдсан цалингийн үеийн өдөр түгжигдэнэ.
 */
import { z } from "zod";
import type { WorkDayStatus } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { DEFAULT_WEEKDAYS, daysBetween, resolveAttendance, type WorkCalendar, type WorkStatus } from "./calc";
import { fromDbDate, toDbDate } from "./dates";
import { holidaySet } from "./holidays";
import { getPayrollSettings } from "./settings";
import { ubDateKey } from "@/lib/time";
import { assertDayOpen, invalidateDay } from "./locks";
import { UserError } from "@/server/errors";

export const WORK_STATUSES = ["WORKED", "HALF_DAY", "PAID_LEAVE", "UNPAID_LEAVE", "SICK", "ABSENT", "OFF"] as const satisfies readonly WorkDayStatus[];

/** Цалин/ирцэд орох ажилтнууд: идэвхтэй гоо сайханч, эсвэл цалин тохируулсан бусад (менежер, нягтлан, админ) */
export async function payrollStaff(opts: { staffId?: string } = {}) {
  return db.user.findMany({
    where: {
      isActive: true,
      ...(opts.staffId && { id: opts.staffId }),
      OR: [{ role: "STAFF" }, { baseSalary: { gt: 0 } }, { salaryHistory: { some: {} } }],
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, baseSalary: true, siCategory: true },
  });
}

/** Ажилтан бүрийн ажлын гаригууд (StaffSchedule; хуваарьгүй бол Да–Ба) + нийтийн амралт */
export async function workCalendars(staffIds: string[], from: string, to: string) {
  const [schedules, holidays, settings] = await Promise.all([
    db.staffSchedule.findMany({ where: { staffId: { in: staffIds } }, select: { staffId: true, weekday: true } }),
    holidaySet(from, to),
    getPayrollSettings(),
  ]);
  const today = ubDateKey();
  const map = new Map<string, WorkCalendar & { fromSchedule: boolean }>();
  for (const id of staffIds) {
    const own = schedules.filter((s) => s.staffId === id).map((s) => s.weekday);
    map.set(id, { weekdays: new Set(own.length ? own : DEFAULT_WEEKDAYS), holidays, fromSchedule: own.length > 0, autoSince: settings.autoAttendanceSince, today });
  }
  return { map, holidays };
}

export async function markedDays(staffIds: string[], from: string, to: string) {
  const rows = await db.workDay.findMany({
    where: { staffId: { in: staffIds }, date: { gte: toDbDate(from), lte: toDbDate(to) } },
    select: { staffId: true, date: true, status: true, hours: true, note: true, updatedAt: true },
  });
  return rows.map((r) => ({ ...r, date: fromDbDate(r.date) }));
}

/** Ирцийн хүснэгт: мөр = ажилтан, багана = өдөр */
export async function attendanceGrid(from: string, to: string, opts: { staffId?: string } = {}) {
  const staff = await payrollStaff(opts);
  const ids = staff.map((s) => s.id);
  // Сарын эхнээс сүүл хүртэлх амралтыг (төлөвлөсөн өдрийн тоо) — хүснэгтэд зөвхөн from..to
  const [{ map, holidays }, marked, locked] = await Promise.all([
    workCalendars(ids, from, to),
    markedDays(ids, from, to),
    db.payrollPeriod.findMany({
      where: { status: { in: ["APPROVED", "PAID"] }, startDate: { lte: toDbDate(to) }, endDate: { gte: toDbDate(from) } },
      select: { startDate: true, endDate: true },
    }),
  ]);
  const days = daysBetween(from, to);
  const lockedDays = new Set(days.filter((d) => locked.some((p) => fromDbDate(p.startDate) <= d && d <= fromDbDate(p.endDate))));
  const rows = staff.map((s) => {
    const cal = map.get(s.id)!;
    const mine = marked.filter((m) => m.staffId === s.id);
    const byDay = new Map(mine.map((m) => [m.date, m]));
    const resolved = resolveAttendance(days, new Map(mine.map((m) => [m.date, m.status as WorkStatus])), cal);
    return {
      id: s.id,
      name: s.name,
      role: s.role,
      fromSchedule: cal.fromSchedule,
      days: resolved.map((d) => ({ ...d, note: byDay.get(d.date)?.note ?? null, hours: byDay.get(d.date)?.hours ?? null })),
    };
  });
  return { days, rows, holidays: [...holidays], lockedDays: [...lockedDays] };
}

export const setWorkDaySchema = z.object({
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(WORK_STATUSES),
  hours: z.number().min(0).max(24).nullable().optional(),
  /** PROMPT 20: гар засвар зөвхөн ADMIN, ЗААВАЛ шалтгаантай (утас эвдэрсэн г.м.) — тайланд "гараар засагдсан" */
  note: z.string({ error: "Шалтгаан заавал." }).trim().min(5, "Засварын шалтгааныг бичнэ үү (5+ тэмдэгт).").max(200),
});

/**
 * Ирцийн гар засвар (PROMPT 20): ирц бүрэн автомат — зөвхөн ADMIN (action: attendance:write), заавал шалтгаантай,
 * тохиргоогоор унтраах боломжтой (payroll settings → attendanceAdminEdit). Мөр үргэлж үлдэнэ (fromEvents = false →
 * "Ирлээ/Явлаа"-аас тооцсоныг дарна, тайланд "гараар засагдсан").
 */
export async function setWorkDay(raw: z.input<typeof setWorkDaySchema>, actorId: string) {
  const input = setWorkDaySchema.parse(raw);
  const settings = await getPayrollSettings();
  if (!settings.attendanceAdminEdit) throw new UserError("Ирцийг гараар засах боломжийг тохиргоогоор хаасан.");
  await assertDayOpen(input.date);
  const where = { staffId_date: { staffId: input.staffId, date: toDbDate(input.date) } };
  return db.$transaction(async (tx) => {
    const before = await tx.workDay.findUnique({ where, select: { id: true, status: true, hours: true, note: true, fromEvents: true } });
    const data = { status: input.status, hours: input.hours ?? null, note: input.note, markedById: actorId, fromEvents: false };
    await tx.workDay.upsert({ where, create: { staffId: input.staffId, date: toDbDate(input.date), ...data }, update: data });
    await invalidateDay(input.date, tx);
    await audit(tx, {
      userId: actorId,
      action: "attendance.manual_edit",
      entity: "WorkDay",
      entityId: `${input.staffId}:${input.date}`,
      before: before ? { status: before.status, hours: before.hours, note: before.note, fromEvents: before.fromEvents } : null,
      after: { status: input.status, hours: input.hours ?? null, reason: input.note },
    });
    return { status: input.status, isDefault: false };
  });
}
