import { Sidebar } from "@/components/admin/Sidebar";
import { ADMIN_NAV } from "@/components/admin/nav";
import { can, ROLE_LABELS } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { logout } from "@/server/actions/auth";
import { ChangePasswordForm } from "@/components/admin/account/ChangePasswordForm";
import { t } from "@/i18n";

// Session (cookie)-оос хамаардаг тул энэ хэсэг request бүрт render хийгдэнэ.
export const instant = false;

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Түр нууц үгтэй: бусад хуудсыг харуулахгүй, эхлээд нууц үгээ солиулна (action-ууд ч хориотой — session.ts)
  if (user.mustChangePassword) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f7f7f6] px-4">
        <div className="w-full max-w-md rounded-lg border border-line bg-white p-6">
          <h1 className="text-[18px] font-medium">{t.admin.account.forcedTitle}</h1>
          <p className="mb-5 mt-1 text-[13px] text-navy/60">{t.admin.account.forcedHint}</p>
          <ChangePasswordForm />
          <form action={logout} className="mt-4">
            <button type="submit" className="text-[13px] underline underline-offset-4">
              {t.admin.logout}
            </button>
          </form>
        </div>
      </div>
    );
  }
  const items = ADMIN_NAV.filter((i) => can(user.role, i.permission));

  return (
    <div className="min-h-dvh bg-[#f7f7f6] lg:flex">
      <Sidebar items={items} user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }} logout={logout} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
