import { BranchLocationForm } from "@/components/admin/attendance/BranchLocationForm";
import { Card, PageHeader } from "@/components/admin/ui";
import { requirePagePermission } from "@/server/auth/session";
import { getBranchLocation } from "@/server/modules/attendance/branch-location";

export const metadata = { title: "Ирцийн байршил" };
export const instant = false;

export default async function AttendanceLocationPage() {
  await requirePagePermission("settings:write");
  const b = await getBranchLocation();
  return (
    <>
      <PageHeader
        eyebrow="Тохиргоо"
        title="Ирцийн байршил"
        description={`${b.name}: ажилтнууд «Ирлээ / Явлаа» товчийг зөвхөн энэ цэгийн ойролцоо дарж болно.`}
      />
      <Card title="Салоны цэг ба радиус">
        <BranchLocationForm initial={b} />
      </Card>
      <p className="mt-4 max-w-2xl text-[13px] text-ink-soft">
        Хязгаарлалт: GPS-ийг тусгай апп-аар хуурах боломжтой. IP шалгалт, ⚠ тэмдэглэгээ, менежерийн хяналт эрсдэлийг бууруулна — 100% биш.
      </p>
    </>
  );
}
