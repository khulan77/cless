import { InviteUserForm } from "@/components/admin/users/UserForms";
import { PageHeader } from "@/components/admin/ui";
import { requirePageAnyPermission } from "@/server/auth/session";
import { assignableRoles, canEditSalary } from "@/server/modules/users/policy";

export const metadata = { title: "Ажилтан урих" };
export const instant = false;

export default async function NewUserPage() {
  const me = await requirePageAnyPermission("user:write", "user:write:staff");
  return (
    <>
      <PageHeader eyebrow="Хэрэглэгч ба эрх" title="Ажилтан урих" description="Утас руу нь идэвхжүүлэх холбоос очно — нууц үгээ өөрөө үүсгэнэ." />
      <div className="max-w-[760px]">
        <InviteUserForm roles={assignableRoles(me.role)} canSalary={canEditSalary(me.role)} />
      </div>
    </>
  );
}
