import { BranchHoursForm, StaffScheduleCard } from "@/components/admin/staff-schedules/ScheduleEditors";
import { PageHeader } from "@/components/admin/ui";
import { t } from "@/i18n";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { getBookingSettings } from "@/server/modules/settings/pos-settings";

export const metadata = { title: "Ажилтан ба хуваарь" };
export const instant = false;

export default async function StaffSchedulesPage() {
  await requirePagePermission("staff-schedule:write");
  const now = new Date();
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
  const bookable = users.filter((u) => u.isBookable);
  const others = users.filter((u) => !u.isBookable);

  return (
    <>
      <PageHeader eyebrow="СПА" title={S.title} description={S.description(users.length)} />
      <div className="space-y-10">
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
    </>
  );
}
