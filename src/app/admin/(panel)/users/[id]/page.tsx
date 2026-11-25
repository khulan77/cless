import { notFound } from "next/navigation";
import { EditUserForm, InviteControls, ResetPasswordForm } from "@/components/admin/users/UserForms";
import { Badge, PageHeader } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/time";
import { db } from "@/server/db";
import { requirePageAnyPermission } from "@/server/auth/session";
import { assignableRoles, canEditSalary, canManageUser } from "@/server/modules/users/policy";
import { t } from "@/i18n";

export const metadata = { title: "Хэрэглэгч" };
export const instant = false;

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePageAnyPermission("user:write", "user:write:staff");
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, loginPhone: true, role: true, isActive: true, baseSalary: true, status: true, invitedAt: true, inviteExpiresAt: true },
  });
  if (!user) notFound();
  const manage = canManageUser(me.role, user.role);
  const U = t.admin.users;
  const expired = user.status === "INVITED" && (!user.inviteExpiresAt || user.inviteExpiresAt < new Date());
  return (
    <>
      <PageHeader
        eyebrow="Хэрэглэгч ба эрх"
        title={user.name}
        description={
          <span className="flex items-center gap-2">
            {user.status === "INVITED" ? <Badge tone={expired ? "red" : "amber"}>{expired ? U.statusExpired : U.statusInvited}</Badge> : user.isActive ? <Badge tone="green">{U.statusActive}</Badge> : <Badge>{U.statusInactive}</Badge>}
          </span>
        }
      />
      <div className="grid max-w-[1000px] gap-5 lg:grid-cols-[1fr_340px]">
        <EditUserForm
          isSelf={user.id === me.id}
          roles={assignableRoles(me.role)}
          canSalary={canEditSalary(me.role)}
          readOnly={!manage}
          initial={{ id: user.id, name: user.name, phone: user.loginPhone ?? user.phone ?? "", email: user.email ?? "", role: user.role, baseSalary: user.baseSalary, isActive: user.isActive }}
        />
        {manage && (
          <div className="space-y-5">
            {user.status === "INVITED" && user.invitedAt && (
              <InviteControls id={user.id} invitedAt={formatDateTime(user.invitedAt)} expiresAt={user.inviteExpiresAt ? formatDateTime(user.inviteExpiresAt) : "—"} expired={expired} />
            )}
            {user.id !== me.id && <ResetPasswordForm id={user.id} />}
          </div>
        )}
      </div>
    </>
  );
}
