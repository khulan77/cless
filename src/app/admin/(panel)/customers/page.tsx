import { ArrowDown, ArrowUp, Download } from "lucide-react";
import Link from "next/link";
import { CustomerFormButton } from "@/components/admin/customers/CustomerForm";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination, parsePage, str } from "@/components/admin/Pagination";
import { Avatar, EmptyState, PageHeader, Table, btnClass, inputClass, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { formatDateLabel } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { listCustomersRanked, type CustomerSort } from "@/server/modules/customers/history";

export const metadata = { title: "Үйлчлүүлэгчид" };
export const instant = false;

const L = t.admin.customers.list;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission("customer:read");
  const sp = await searchParams;
  const q = str(sp.q);
  const { rows, count, page, pageSize, sort, dir } = await listCustomersRanked({ q, sort: str(sp.sort), dir: str(sp.dir), page: parsePage(sp.page) });
  const showContact = can(user.role, "customer:contact:read");

  const params = (over: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, sort, dir, ...over })) if (v) s.set(k, v);
    return `/admin/customers?${s.toString()}`;
  };
  /** Clicking the active column flips the direction; a new column starts high → low (names A → Я) */
  const head = (key: CustomerSort, label: string, right = true) => {
    const active = sort === key;
    const next = active ? (dir === "desc" ? "asc" : "desc") : key === "name" ? "asc" : "desc";
    const Icon = dir === "desc" ? ArrowDown : ArrowUp;
    return (
      <th className={`${thClass} ${right ? "text-right" : ""}`} aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}>
        <Link href={params({ sort: key, dir: next, page: undefined })} className={`inline-flex items-center gap-1 hover:text-ink ${active ? "font-semibold text-ink" : ""}`}>
          {label}
          {active && <Icon className="size-3.5" aria-hidden />}
        </Link>
      </th>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Үйлчлүүлэгч"
        title="Үйлчлүүлэгчид"
        description={L.description(count)}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={`/api/admin/customers.csv?${new URLSearchParams({ q: q ?? "", sort, dir }).toString()}`} className={btnClass("secondary")}>
              <Download className="size-[18px]" strokeWidth={1.75} aria-hidden /> {t.admin.report.csv}
            </a>
            {can(user.role, "customer:write") && <CustomerFormButton label={t.admin.customers.create} />}
          </div>
        }
      />
      <FilterBar action="/admin/customers" resetHref={q ? "/admin/customers" : undefined}>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input name="q" defaultValue={q} placeholder="Нэр, утас, имэйлээр хайх" aria-label="Хайх" className={`${inputClass} w-80`} />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title={q ? "Хайлтад тохирох үйлчлүүлэгч алга" : "Одоогоор үйлчлүүлэгч алга"}>Цаг захиалах эсвэл касс дээр шинэ үйлчлүүлэгч нэмэгдэнэ.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              {head("name", L.name, false)}
              {showContact && <th className={thClass}>{L.phone}</th>}
              {head("total", L.total)}
              {head("product", L.product)}
              {head("service", L.service)}
              {head("visits", L.visits)}
              {head("lastVisit", L.lastVisit)}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-canvas">
                <td className={tdClass}>
                  <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3 font-medium hover:underline">
                    <Avatar name={c.name} id={c.id} size={32} />
                    {c.name}
                  </Link>
                </td>
                {showContact && <td className={`${tdClass} tabular-nums`}>{c.phone}</td>}
                <td className={`${tdClass} text-right font-semibold tabular-nums`}>{formatMNT(c.total)}</td>
                <td className={`${tdClass} text-right tabular-nums text-ink-soft`}>{formatMNT(c.product)}</td>
                <td className={`${tdClass} text-right tabular-nums text-ink-soft`}>{formatMNT(c.service)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{c.visits}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{c.lastVisit ? formatDateLabel(c.lastVisit) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pageSize={pageSize} total={count} basePath="/admin/customers" params={{ q, sort, dir }} />
    </>
  );
}
