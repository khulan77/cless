import { Sidebar } from "@/components/admin/Sidebar";
import { Topbar } from "@/components/admin/Topbar";
import { navFor, withoutHrefs } from "@/components/admin/nav";
import { getPosSettings } from "@/server/modules/settings/pos-settings";
import { canView } from "@/server/modules/finance/access";
import { getSalonInfo } from "@/server/queries/storefront";
import { countNewInquiries } from "@/server/modules/inquiries/service";
import { failedEmailCount } from "@/server/modules/outbox/monitor";
import { can, isReadOnly } from "@/server/auth/permissions";
import { ReadOnlyBanner } from "@/components/admin/readonly/ReadOnly";
import { requireUser } from "@/server/auth/session";
import { logout } from "@/server/actions/auth";
import { ChangePasswordForm } from "@/components/admin/account/ChangePasswordForm";
import { t } from "@/i18n";
import { db } from "@/server/db";
import { newOnlineCustomers } from "@/server/modules/customer-auth/account";

// Session (cookie)-оос хамаардаг тул энэ хэсэг request бүрт render хийгдэнэ.
export const instant = false;

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Түр нууц үгтэй: бусад хуудсыг харуулахгүй, эхлээд нууц үгээ солиулна (action-ууд ч хориотой — session.ts)
  if (user.mustChangePassword) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-hairline bg-white p-8">
          <h1 className="font-display text-[28px] font-semibold">{t.admin.account.forcedTitle}</h1>
          <p className="mb-6 mt-1 text-[15px] text-ink-soft">{t.admin.account.forcedHint}</p>
          <ChangePasswordForm />
          <form action={logout} className="mt-4">
            <button type="submit" className="min-h-11 text-[14px] underline underline-offset-4">
              {t.admin.logout}
            </button>
          </form>
        </div>
      </div>
    );
  }
  // Санхүү: MANAGER-т тохиргоогоор зөвхөн харах (finance/access.ts)
  const [viewExpenses, viewFinance, viewPayroll] = await Promise.all([canView(user.role, "expenses"), canView(user.role, "finance"), canView(user.role, "payroll")]);
  // PROMPT 20: кассын ээлж унтраалттай (анхдагч) бол цэснээс нууна (түүх /admin/shifts-д хэвээр)
  const shiftsOn = (await getPosSettings()).cashShiftsEnabled;
  const entries = withoutHrefs(navFor((p) => (p === "expense:read" ? viewExpenses : p === "finance:read" ? viewFinance : p === "payroll:read" ? viewPayroll : can(user.role, p))), shiftsOn ? [] : ["/admin/shifts"]);
  // Утасгүй/баталгаажаагүй хэрэглэгчид утсаа нэмэхийг санал болгоно (PROMPT 15 §2)
  const phoneVerified = Boolean((await db.user.findUnique({ where: { id: user.id }, select: { loginPhone: true } }))?.loginPhone);
  // Онлайн захиалга (батлах хүлээж буй) ба сайтаас шинээр бүртгүүлсэн (24 цаг) — MANAGER, ADMIN (PROMPT 15)
  const canOnline = can(user.role, "appointment:write");
  const [salon, newInquiries, failedEmails, pendingOnline, newOnline] = await Promise.all([
    getSalonInfo(),
    can(user.role, "inquiry:manage") ? countNewInquiries() : null,
    can(user.role, "settings:write") ? failedEmailCount() : null,
    canOnline ? db.appointment.count({ where: { status: "PENDING" } }) : null,
    canOnline ? newOnlineCustomers() : null,
  ]);
  // Bell: only what already exists — new "Салонд захиалах" requests and unsent e-mails (ADMIN)
  const notices = [
    ...(newInquiries !== null ? [{ key: "inquiries", label: t.admin.bell.inquiries(newInquiries), count: newInquiries, href: "/admin/inquiries?status=NEW" }] : []),
    ...(pendingOnline ? [{ key: "online", label: `Онлайн захиалга батлахыг хүлээж буй: ${pendingOnline}`, count: pendingOnline, href: "/admin/calendar" }] : []),
    ...(newOnline ? [{ key: "online-customers", label: `Сайтаас шинээр бүртгүүлсэн (24 цаг): ${newOnline}`, count: newOnline, href: "/admin/customers?origin=online" }] : []),
    ...(failedEmails !== null ? [{ key: "emails", label: t.admin.bell.emails(failedEmails), count: failedEmails, href: "/admin/system" }] : []),
  ];
  const me = { name: user.name, id: user.id, role: t.admin.nav.roles[user.role] ?? user.role };

  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar entries={entries} brand={salon.name || salon.siteName} user={me} logout={logout} tag={user.role === "ACCOUNTANT" ? t.admin.nav.roles.ACCOUNTANT : undefined} />
      {/* Full width to the right of the sidebar, 40px padding */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar entries={entries} user={me} notices={notices} />
        <main id="main" className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8 lg:p-10">
          {isReadOnly(user.role) && <ReadOnlyBanner />}
          {!phoneVerified && (
            <p role="status" className="mb-5 rounded-xl border border-hairline bg-white px-4 py-2.5 text-[14px]">
              Утсаа баталгаажуулбал утсаараа нэвтэрч, нууц үгээ SMS-ээр сэргээнэ.{" "}
              <a href="/admin/account" className="font-medium underline underline-offset-4">Баталгаажуулах</a>
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
