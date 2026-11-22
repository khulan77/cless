import { CalendarBoard } from "@/components/admin/calendar/CalendarBoard";
import type { CalAppt, CalColumn } from "@/components/admin/calendar/types";
import { PageHeader } from "@/components/admin/ui";
import { formatDateLabel, isDateKey, ubDateKey, ubWeekday, addDays } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { dayView, weekView, type CalendarAppt } from "@/server/modules/appointments/queries";
import { bookableStaff } from "@/server/modules/appointments/repo";

export const metadata = { title: "Календарь" };
export const instant = false;

const serialize = (a: CalendarAppt): CalAppt => ({
  ...a,
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
  const canContact = can(user.role, "customer:contact:read");

  const [services, staff] = await Promise.all([
    db.service.findMany({
      where: { isActive: true, bookable: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, durationMin: true, bufferMin: true, requiresRoom: true },
    }),
    bookableStaff(),
  ]);
  const staffList = staff.map((s) => ({ id: s.id, name: s.name }));

  let columns: CalColumn[];
  let appointments: CalAppt[];
  let axis: { startMin: number; endMin: number };
  let slotMinutes: number;
  let cancelReasons: string[];
  let weekStaffId: string | null = null;

  if (view === "week") {
    weekStaffId = typeof sp.staff === "string" && staff.some((s) => s.id === sp.staff) ? sp.staff : (staff[0]?.id ?? null);
    // Week starts on Monday (UB)
    const weekStart = addDays(date, -((ubWeekday(date) + 6) % 7));
    const data = weekStaffId ? await weekView(weekStaffId, weekStart, { canContact }) : null;
    const day = await dayView(date, { canContact }); // for cancel reasons / slot settings
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
    appointments = (data?.appointments ?? []).map(serialize);
    axis = data?.axis ?? day.axis;
    slotMinutes = data?.slotMinutes ?? day.slotMinutes;
    cancelReasons = day.cancelReasons;
  } else {
    const data = await dayView(date, { canContact });
    columns = data.staff.map((s) => ({ key: s.id, label: s.name, date, staffId: s.id, working: iso(s.working), timeOff: iso(s.timeOff) }));
    appointments = data.appointments.map(serialize);
    axis = data.axis;
    slotMinutes = data.slotMinutes;
    cancelReasons = data.cancelReasons;
  }

  return (
    <>
      <PageHeader title="Календарь" description={formatDateLabel(date)} />
      <CalendarBoard
        view={view}
        date={date}
        weekStaffId={weekStaffId}
        columns={columns}
        appointments={appointments}
        axis={axis}
        slotMinutes={slotMinutes}
        services={services}
        staff={staffList}
        cancelReasons={cancelReasons}
        perms={{
          canWrite: can(user.role, "appointment:write"),
          canStatus: can(user.role, "appointment:status"),
          canDoneManual: can(user.role, "appointment:done-manual"),
          canPos: can(user.role, "sale:create"),
        }}
      />
    </>
  );
}
