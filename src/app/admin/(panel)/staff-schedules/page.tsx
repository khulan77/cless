import { BranchHoursForm, StaffScheduleCard } from "@/components/admin/staff-schedules/ScheduleEditors";
import { PageHeader } from "@/components/admin/ui";
import { t } from "@/i18n";
import { requirePageOrView } from "@/server/auth/session";
import { ReadOnlyFieldset } from "@/components/admin/readonly/ReadOnly";
import { db } from "@/server/db";
import { getBookingSettings } from "@/server/modules/settings/pos-settings";
import { WeekGrid } from "@/components/admin/staff-schedules/WeekGrid";
import { addDays, ubDateKey, ubDayRange, ubWeekday } from "@/lib/time";

export const metadata = { title: "Ажилтан ба хуваарь" };
export const instant = false;

export default async function StaffSchedulesPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { readOnly } = await requirePageOrView("staff-schedule:write");
  const now = new Date();
  // 7 хоногийн хүснэгт: Даваа гарагаас эхэлнэ (?week=YYYY-MM-DD — тухайн 7 хоногийн аль ч өдөр)
  const todayKey = ubDateKey(now);
  const wq = (await searchParams).week;
  const anchor = typeof wq === "string" && /^\d{4}-\d{2}-\d{2}$/.test(wq) ? wq : todayKey;
  const monday = addDays(anchor, -((ubWeekday(anchor) + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekStart = ubDayRange(weekDays[0]!).start;
  const weekEnd = ubDayRange(weekDays[6]!).end;
  const [settings, users, services] = await Promise.all([
    getBookingSettings(),
    db.user.findMany({
      where: { isActive: true },
      orderBy: [{ isBookable: "desc" }, { role: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
        isBookable: true,
        phone: true,
        schedules: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }], select: { weekday: true, startTime: true, endTime: true } },
        timeOffs: { where: { endsAt: { gt: now } }, orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, endsAt: true, reason: true, note: true } },
        services: { select: { serviceId: true } },
      },
    }),
    db.service.findMany({ where: { isActive: true, bookable: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const weekOffs = await db.staffTimeOff.findMany({ where: { startsAt: { lt: weekEnd }, endsAt: { gt: weekStart } }, select: { staffId: true, startsAt: true, endsAt: true, reason: true } });
  const upcoming = await db.appointment.groupBy({
    by: ["staffId"],
    where: { startsAt: { gte: now }, status: { in: ["BOOKED", "CONFIRMED"] } },
    _count: true,
  });
  const S = t.admin.staffSchedules;
  const card = (u: (typeof users)[number]) => (
    <StaffScheduleCard
      key={u.id}
      services={services}
      staff={{
        id: u.id,
        name: u.name,
        roleLabel: t.admin.nav.roles[u.role] ?? u.role,
        phone: u.phone,
        isBookable: u.isBookable,
        upcoming: upcoming.find((x) => x.staffId === u.id)?._count ?? 0,
        schedule: u.schedules,
        timeOff: u.timeOffs.map((o) => ({ ...o, startsAt: o.startsAt.toISOString(), endsAt: o.endsAt.toISOString() })),
        serviceIds: u.services.map((s) => s.serviceId),
      }}
    />
  );
  const gridRows = users.map((u) => ({
    id: u.id,
    name: u.name,
    roleLabel: t.admin.nav.roles[u.role] ?? u.role,
    cells: weekDays.map((day) => {
      const { start, end } = ubDayRange(day);
      const off = weekOffs.find((o) => o.staffId === u.id && o.startsAt < end && o.endsAt > start);
      return {
        day,
        intervals: u.schedules.filter((x) => x.weekday === ubWeekday(day)).map((x) => `${x.startTime}–${x.endTime}`),
        leave: off ? t.admin.timeOffReason[off.reason] : null,
      };
    }),
  }));
  const bookable = users.filter((u) => u.isBookable);
  const others = users.filter((u) => !u.isBookable);

  return (
    <>
      <PageHeader eyebrow="СПА" title={S.title} description={S.description(users.length)} />
      <ReadOnlyFieldset readOnly={readOnly}>
      <div className="space-y-10">
        <WeekGrid
          rows={gridRows}
          days={weekDays}
          todayKey={todayKey}
          prevHref={`/admin/staff-schedules?week=${addDays(monday, -7)}`}
          nextHref={`/admin/staff-schedules?week=${addDays(monday, 7)}`}
        />
        <section>
          <h2 className="mb-4 font-display text-[22px] font-semibold">{S.bookableSection}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{bookable.map(card)}</div>
        </section>
        <BranchHoursForm initial={{ hours: settings.hours as Record<string, { start: string; end: string }[]>, slotMinutes: settings.slotMinutes, minLeadMinutes: settings.minLeadMinutes }} />
        {others.length > 0 && (
          <section>
            <h2 className="mb-4 font-display text-[22px] font-semibold">{S.otherSection}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{others.map(card)}</div>
          </section>
        )}
      </div>
      </ReadOnlyFieldset>
    </>
  );
}
