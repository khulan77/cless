import { CalendarBoard } from "@/components/admin/calendar/CalendarBoard";
import type { CalAppt, CalColumn } from "@/components/admin/calendar/types";
import { t } from "@/i18n";
import { formatDateLabel, isDateKey, ubAt, ubDateKey, ubDayRange, ubWeekday, addDays } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { dayView, weekView, type CalendarAppt } from "@/server/modules/appointments/queries";
import { bookableStaff } from "@/server/modules/appointments/repo";
import { calendarMoney } from "@/server/modules/appointments/calendar-stats";

export const metadata = { title: "Календарь" };
export const instant = false;

const serialize = (a: CalendarAppt, money: Record<string, { price: number; paid: number }>): CalAppt => ({
  ...a,
  price: money[a.id]?.price ?? 0,
  paid: money[a.id]?.paid ?? 0,
  startsAt: a.startsAt.toISOString(),
  endsAt: a.endsAt.toISOString(),
  blockedUntil: a.blockedUntil.toISOString(),
});
const iso = (list: { start: Date; end: Date; reason?: string }[]) =>
  list.map((i) => ({ start: i.start.toISOString(), end: i.end.toISOString(), reason: i.reason ?? "" }));

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission("appointment:read");
  const sp = await searchParams;
  const date = typeof sp.date === "string" && isDateKey(sp.date) ? sp.date : ubDateKey();
  const view = sp.view === "week" ? "week" : "day";
  // Day view: columns by staff (default) or by room
  const by = view === "day" && sp.by === "room" ? "room" : "staff";
  const canContact = can(user.role, "customer:contact:read");

  const [services, staff] = await Promise.all([
    db.service.findMany({
      where: { isActive: true, bookable: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, durationMin: true, bufferMin: true, requiresRoom: true, price: true, priceFrom: true, category: true },
    }),
    bookableStaff(),
  ]);
  const staffList = staff.map((s) => ({ id: s.id, name: s.name }));

  let columns: CalColumn[];
  let appointments: CalAppt[];
  let axis: { startMin: number; endMin: number };
  let slotMinutes: number;
  let weekStaffId: string | null = null;
  let cancelled = 0;

  if (view === "week") {
    weekStaffId = typeof sp.staff === "string" && staff.some((s) => s.id === sp.staff) ? sp.staff : (staff[0]?.id ?? null);
    // Week starts on Monday (UB)
    const weekStart = addDays(date, -((ubWeekday(date) + 6) % 7));
    const data = weekStaffId ? await weekView(weekStaffId, weekStart, { canContact }) : null;
    const day = await dayView(date, { canContact }); // slot settings when the staff member has no data
    columns = data
      ? data.days.map((d) => ({
          key: d.date,
          label: formatDateLabel(d.date),
          date: d.date,
          staffId: weekStaffId!,
          working: iso(d.working),
          timeOff: iso(d.timeOff),
        }))
      : [];
    const stats = await calendarMoney({ start: ubDayRange(weekStart).start, end: ubDayRange(addDays(weekStart, 6)).end }, weekStaffId);
    cancelled = stats.cancelled;
    appointments = (data?.appointments ?? []).map((a) => serialize(a, stats.money));
    axis = data?.axis ?? day.axis;
    slotMinutes = data?.slotMinutes ?? day.slotMinutes;
  } else {
    const [data, stats] = await Promise.all([dayView(date, { canContact }), calendarMoney(ubDayRange(date))]);
    cancelled = stats.cancelled;
    if (by === "room") {
      // A room is free whenever the salon is open; appointments without a room get their own column
      const open = data.branchHours.map((h) => ({ start: ubAt(date, h.start), end: ubAt(date, h.end) }));
      columns = data.rooms.map((r) => ({ key: r.id, label: r.name, date, staffId: "", roomId: r.id, working: iso(open), timeOff: [] }));
      if (data.appointments.some((a) => !a.roomId)) columns.push({ key: "no-room", label: t.admin.calendar.noRoom, date, staffId: "", roomId: null, working: iso(open), timeOff: [] });
    } else {
      columns = data.staff.map((s) => ({ key: s.id, label: s.name, date, staffId: s.id, working: iso(s.working), timeOff: iso(s.timeOff) }));
    }
    appointments = data.appointments.map((a) => serialize(a, stats.money));
    axis = data.axis;
    slotMinutes = data.slotMinutes;
  }

  return (
    <>
      <h1 className="sr-only">Календарь</h1>
      <CalendarBoard
        cancelled={cancelled}
        view={view}
        by={by}
        date={date}
        weekStaffId={weekStaffId}
        columns={columns}
        appointments={appointments}
        axis={axis}
        slotMinutes={slotMinutes}
        services={services}
        staff={staffList}
        perms={{
          canWrite: can(user.role, "appointment:write"),
          canStatus: can(user.role, "appointment:status"),
          canDoneManual: can(user.role, "appointment:done-manual"),
          canPos: can(user.role, "sale:create"),
          canInvite: can(user.role, "user:write") || can(user.role, "user:write:staff"),
          canSchedule: can(user.role, "staff-schedule:write"),
        }}
      />
    </>
  );
}
