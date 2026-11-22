import { EmptyState, PageHeader } from "@/components/admin/ui";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Миний хуваарь" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function MySchedulePage() {
  await requirePagePermission("schedule:own");
  return (
    <>
      <PageHeader title="Миний хуваарь" description="Танд оноогдсон цагууд энд харагдана." />
      <EmptyState title="Хуваарь удахгүй нэмэгдэнэ">Цаг захиалгын модуль дараагийн шатанд хийгдэнэ.</EmptyState>
    </>
  );
}
