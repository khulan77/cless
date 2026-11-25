import { ChangePasswordForm } from "@/components/admin/account/ChangePasswordForm";
import { Card, PageHeader } from "@/components/admin/ui";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { VerifyPhoneForm } from "@/components/admin/account/VerifyPhoneForm";
import { db } from "@/server/db";

export const metadata = { title: "Миний бүртгэл" };
export const instant = false;

export default async function AccountPage() {
  const user = await requireUser();
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { loginPhone: true, phone: true } });
  return (
    <>
      <PageHeader eyebrow="Хэрэглэгч" title="Миний бүртгэл" description={[user.name, user.email, ROLE_LABELS[user.role]].filter(Boolean).join(" · ")} />
      <div className="max-w-[760px] space-y-5">
        <Card
          title="Утсаар нэвтрэх"
          description={me.loginPhone ? `Баталгаажсан утас: ${me.loginPhone}. Утас + нууц үгээр нэвтэрч болно.` : "Утсаа кодоор баталгаажуулбал утас + нууц үгээр нэвтэрч, нууц үгээ мартсан үед SMS-ээр сэргээнэ."}
        >
          <VerifyPhoneForm current={me.loginPhone ?? me.phone} />
        </Card>
        <Card title="Нууц үг солих">
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
