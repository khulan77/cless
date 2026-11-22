import { notFound } from "next/navigation";
import { EditUserForm, ResetPasswordForm } from "@/components/admin/users/UserForms";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/server/db";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Хэрэглэгч" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePagePermission("user:write");
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, baseSalary: true },
  });
  if (!user) notFound();
  return (
    <>
      <PageHeader title={user.name} />
      <div className="grid max-w-[1000px] gap-5 lg:grid-cols-[1fr_340px]">
        <EditUserForm
          email={user.email}
          isSelf={user.id === me.id}
          initial={{ id: user.id, name: user.name, phone: user.phone ?? "", role: user.role, baseSalary: user.baseSalary, isActive: user.isActive }}
        />
        <ResetPasswordForm id={user.id} />
      </div>
    </>
  );
}
