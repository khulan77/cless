import { CreateUserForm } from "@/components/admin/users/UserForms";
import { PageHeader } from "@/components/admin/ui";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Хэрэглэгч нэмэх" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function NewUserPage() {
  await requirePagePermission("user:write");
  return (
    <>
      <PageHeader eyebrow="Хэрэглэгч ба эрх" title="Хэрэглэгч нэмэх" description="Түр нууц үг өгнө — анх нэвтрэхэд өөрөө солино." />
      <div className="max-w-[760px]">
        <CreateUserForm />
      </div>
    </>
  );
}
