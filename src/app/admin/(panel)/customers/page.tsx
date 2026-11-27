import { ArrowDown, ArrowUp, Download } from "lucide-react";
import Link from "next/link";
import { CustomerFormButton } from "@/components/admin/customers/CustomerForm";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination, parsePage, str } from "@/components/admin/Pagination";
import { Avatar, Badge, EmptyState, PageHeader, Table, btnClass, inputClass, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { formatDateLabel, ubDateKey } from "@/lib/time";
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
  const online = str(sp.origin) === "online" ? "online" : undefined;
  // PROMPT 27: "Энэ сард төрсөн өдөртэй"
  const bday = str(sp.bday) === "month" ? "month" : undefined;
  const thisMonth = Number(ubDateKey().slice(5, 7));
  const { rows, count, page, pageSize, sort, dir } = await listCustomersRanked({ q, sort: str(sp.sort), dir: str(sp.dir), page: parsePage(sp.page), online: Boolean(online), birthMonth: bday ? thisMonth : undefined });
  const showContact = can(user.role, "customer:contact:read");

  const params = (over: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, sort, dir, origin: online, bday, ...over })) if (v) s.set(k, v);
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
      <FilterBar action="/admin/customers" resetHref={q || online || bday ? "/admin/customers" : undefined}>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input name="q" defaultValue={q} placeholder="Нэр, утас, имэйлээр хайх" aria-label="Хайх" className={`${inputClass} w-80`} />
        <select name="origin" defaultValue={online ?? ""} aria-label="Бүртгэл" className={`${inputClass} w-56`}>
          <option value="">Бүх үйлчлүүлэгч</option>
          <option value="online">Сайтаас бүртгүүлсэн</option>
        </select>
        <select name="bday" defaultValue={bday ?? ""} aria-label="Төрсөн өдөр" className={`${inputClass} w-64`}>
          <option value="">Төрсөн өдөр — бүгд</option>
          <option value="month">Энэ сард төрсөн өдөртэй</option>
        </select>
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title={q ? "Хайлтад тохирох үйлчлүүлэгч алга" : "Одоогоор үйлчлүүлэгч алга"}>Цаг захиалах эсвэл касс дээр шинэ үйлчлүүлэгч нэмэгдэнэ.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              {head("name", L.name, false)}
              {showContact && <th className={thClass}>{L.phone}</th>}
              <th className={thClass}>Төрсөн огноо</th>
              {head("total", L.total)}
              {head("product", L.product)}
              {head("service", L.service)}
              {head("visits", L.visits)}
              {head("noShows", "Ороогүй")}
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
                  {c.registeredVia === "ONLINE" && <span className="ml-11 mt-0.5 inline-block"><Badge tone="info">Онлайн</Badge></span>}
                </td>
                {showContact && <td className={`${tdClass} tabular-nums`}>{c.phone}</td>}
                <td className={`${tdClass} tabular-nums text-ink-soft`}>{c.birthday ? c.birthday.toISOString().slice(0, 10) : "—"}</td>
                <td className={`${tdClass} text-right font-semibold tabular-nums`}>{formatMNT(c.total)}</td>
                <td className={`${tdClass} text-right tabular-nums text-ink-soft`}>{formatMNT(c.product)}</td>
                <td className={`${tdClass} text-right tabular-nums text-ink-soft`}>{formatMNT(c.service)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{c.visits}</td>
                <td className={`${tdClass} text-right tabular-nums ${c.noShows > 0 ? "text-err" : "text-ink-soft"}`}>{c.noShows}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{c.lastVisit ? formatDateLabel(c.lastVisit) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pageSize={pageSize} total={count} basePath="/admin/customers" params={{ q, sort, dir, origin: online, bday }} />
    </>
  );
}
