import { ChangePasswordForm } from "@/components/admin/account/ChangePasswordForm";
import { Card, PageHeader } from "@/components/admin/ui";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Миний бүртгэл" };
export const instant = false;

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader eyebrow="Хэрэглэгч" title="Миний бүртгэл" description={`${user.name} · ${user.email} · ${ROLE_LABELS[user.role]}`} />
      <Card title="Нууц үг солих" className="max-w-[760px]">
        <ChangePasswordForm />
      </Card>
    </>
  );
}
