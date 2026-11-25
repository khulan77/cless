import { OnlineBookingForm } from "@/components/admin/notify/OnlineBookingForm";
import { PageHeader } from "@/components/admin/ui";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { getOnlineBookingSettings } from "@/server/modules/online-booking/settings";

export const metadata = { title: "Онлайн захиалга" };
export const instant = false;

export default async function OnlineBookingSettingsPage() {
  await requirePagePermission("settings:write");
  const [settings, services] = await Promise.all([
    getOnlineBookingSettings(),
    db.service.findMany({ where: { isActive: true, bookable: true, isPublic: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, category: true } }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Тохиргоо" title="Онлайн захиалга" description="Сайтаар цаг захиалах дүрэм: батлах горим, хугацаа, цуцлах эрх, үйлчилгээ." />
      <OnlineBookingForm initial={settings} services={services} />
    </>
  );
}
