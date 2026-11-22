import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination, parsePage, str } from "@/components/admin/Pagination";
import { Badge, EmptyState, PageHeader, Table, btnClass, inputClass, tdClass, thClass } from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";
import { formatMNT } from "@/lib/money";
import { ROLES } from "@/lib/validation/user";
import { db } from "@/server/db";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Хэрэглэгчид" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;
const PAGE_SIZE = 20;

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePagePermission("user:write");
  const sp = await searchParams;
  const q = str(sp.q);
  const role = ROLES.find((r) => r === str(sp.role));
  const status = str(sp.status);
  const page = parsePage(sp.page);

  const where: Prisma.UserWhereInput = {
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] }),
    ...(role && { role }),
    ...(status === "active" && { isActive: true }),
    ...(status === "inactive" && { isActive: false }),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, baseSalary: true },
    }),
  ]);

  return (
    <>
      <PageHeader title="Хэрэглэгчид" description="Ажилтан, эрх, үндсэн цалин" actions={<Link href="/admin/users/new" className={btnClass("primary")}>+ Хэрэглэгч нэмэх</Link>} />
      <FilterBar action="/admin/users" resetHref={q || role || status ? "/admin/users" : undefined}>
        <input name="q" defaultValue={q} placeholder="Нэр, имэйл, утас" aria-label="Хайх" className={`${inputClass} w-64`} />
        <select name="role" defaultValue={role ?? ""} aria-label="Эрх" className={`${inputClass} w-36`}>
          <option value="">Бүх эрх</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ""} aria-label="Төлөв" className={`${inputClass} w-36`}>
          <option value="">Бүгд</option>
          <option value="active">Идэвхтэй</option>
          <option value="inactive">Идэвхгүй</option>
        </select>
      </FilterBar>
      {users.length === 0 ? (
        <EmptyState title="Хэрэглэгч олдсонгүй" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>Нэр</th>
              <th className={thClass}>Имэйл</th>
              <th className={thClass}>Утас</th>
              <th className={thClass}>Эрх</th>
              <th className={`${thClass} text-right`}>Үндсэн цалин</th>
              <th className={thClass}>Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? "hover:bg-navy/[0.02]" : "text-navy/45"}>
                <td className={tdClass}>
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{u.name}</Link>
                  {u.id === me.id && <span className="ml-2 text-[11px] text-navy/45">(та)</span>}
                </td>
                <td className={tdClass}>{u.email}</td>
                <td className={tdClass}>{u.phone ?? "—"}</td>
                <td className={tdClass}><Badge tone={u.role === "ADMIN" ? "navy" : "neutral"}>{ROLE_LABELS[u.role]}</Badge></td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(u.baseSalary)}</td>
                <td className={tdClass}>{u.isActive ? <Badge tone="green">Идэвхтэй</Badge> : <Badge>Идэвхгүй</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/users" params={{ q, role, status }} />
    </>
  );
}
