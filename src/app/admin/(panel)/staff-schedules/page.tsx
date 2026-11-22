import { BranchHoursForm, StaffScheduleCard } from "@/components/admin/staff-schedules/ScheduleEditors";
import { PageHeader } from "@/components/admin/ui";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { getBookingSettings } from "@/server/modules/settings/pos-settings";

export const metadata = { title: "Ажлын хуваарь" };
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
        schedules: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }], select: { weekday: true, startTime: true, endTime: true } },
        timeOffs: { where: { endsAt: { gt: now } }, orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, endsAt: true, reason: true, note: true } },
        services: { select: { serviceId: true } },
      },
    }),
    db.service.findMany({ where: { isActive: true, bookable: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title="Ажлын хуваарь" description="Салбар ба ажилтны ажлын цаг, чөлөө, хийж чадах үйлчилгээ" />
      <div className="space-y-6">
        <BranchHoursForm initial={{ hours: settings.hours as Record<string, { start: string; end: string }[]>, slotMinutes: settings.slotMinutes, minLeadMinutes: settings.minLeadMinutes }} />
        {users.map((u) => (
          <StaffScheduleCard
            key={u.id}
            services={services}
            staff={{
              id: u.id,
              name: u.name,
              roleLabel: ROLE_LABELS[u.role],
              isBookable: u.isBookable,
              schedule: u.schedules,
              timeOff: u.timeOffs.map((o) => ({ ...o, startsAt: o.startsAt.toISOString(), endsAt: o.endsAt.toISOString() })),
              serviceIds: u.services.map((s) => s.serviceId),
            }}
          />
        ))}
      </div>
    </>
  );
}
