import { Sidebar } from "@/components/admin/Sidebar";
import { ADMIN_NAV } from "@/components/admin/nav";
import { can, ROLE_LABELS } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { logout } from "@/server/actions/auth";

// Session (cookie)-оос хамаардаг тул энэ хэсэг request бүрт render хийгдэнэ.
export const instant = false;

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
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
