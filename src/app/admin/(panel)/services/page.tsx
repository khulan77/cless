import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination, parsePage, str } from "@/components/admin/Pagination";
import { Badge, EmptyState, PageHeader, Table, btnClass, inputClass, tdClass, thClass } from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";
import { formatMNT } from "@/lib/money";
import { db } from "@/server/db";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Үйлчилгээ" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;
const PAGE_SIZE = 20;

export default async function ServicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission("service:write");
  const sp = await searchParams;
  const q = str(sp.q);
  const status = str(sp.status);
  const page = parsePage(sp.page);

  const where: Prisma.ServiceWhereInput = {
    ...(q && { name: { contains: q, mode: "insensitive" } }),
    ...(status === "active" && { isActive: true }),
    ...(status === "archived" && { isActive: false }),
  };
  const [total, services] = await Promise.all([
    db.service.count({ where }),
    db.service.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { consumables: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title="Үйлчилгээ" description="Салоны үйлчилгээ, үнэ, орц" actions={<Link href="/admin/services/new" className={btnClass("primary")}>+ Шинэ үйлчилгээ</Link>} />
      <FilterBar action="/admin/services" resetHref={q || status ? "/admin/services" : undefined}>
        <input name="q" defaultValue={q} placeholder="Нэрээр хайх" aria-label="Хайх" className={`${inputClass} w-64`} />
        <select name="status" defaultValue={status ?? ""} aria-label="Төлөв" className={`${inputClass} w-40`}>
          <option value="">Бүгд</option>
          <option value="active">Идэвхтэй</option>
          <option value="archived">Архив</option>
        </select>
      </FilterBar>
      {services.length === 0 ? (
        <EmptyState title="Үйлчилгээ олдсонгүй" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>Нэр</th>
              <th className={`${thClass} text-right`}>Хугацаа</th>
              <th className={`${thClass} text-right`}>Үнэ</th>
              <th className={`${thClass} text-right`}>Орц</th>
              <th className={thClass}>Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="hover:bg-navy/[0.02]">
                <td className={tdClass}><Link href={`/admin/services/${s.id}`} className="font-medium hover:underline">{s.name}</Link></td>
                <td className={`${tdClass} text-right tabular-nums`}>{s.durationMin} мин</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(s.price)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{s._count.consumables}</td>
                <td className={tdClass}>{s.isActive ? <Badge tone="green">Идэвхтэй</Badge> : <Badge>Архив</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/services" params={{ q, status }} />
    </>
  );
}
