import { RoomsEditor } from "@/components/admin/rooms/RoomsEditor";
import { PageHeader } from "@/components/admin/ui";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata = { title: "Өрөө" };
export const instant = false;

export default async function RoomsPage() {
  await requirePagePermission("room:write");
  const rooms = await db.room.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isActive: true, sortOrder: true } });
  return (
    <>
      <PageHeader eyebrow="СПА" title="Эмчилгээний өрөө" description="Өрөө шаарддаг үйлчилгээний цагийг давхцуулахгүй." />
      <div className="max-w-[760px]">
        <RoomsEditor rooms={rooms} />
      </div>
    </>
  );
}
