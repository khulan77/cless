import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination, parsePage, str } from "@/components/admin/Pagination";
import { Badge, EmptyState, PageHeader, Select, Table, inputClass, tdClass, thClass } from "@/components/admin/ui";
import type { SaleStatus } from "@/generated/prisma/client";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { saleStatusTone } from "@/lib/sale-status";
import { requirePagePermission } from "@/server/auth/session";
import { listSales } from "@/server/modules/sales/queries";

export const metadata = { title: "Борлуулалт" };
export const instant = false;

const STATUSES = Object.keys(t.admin.saleStatus) as SaleStatus[];

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission("sale:read");
  const sp = await searchParams;
  const q = str(sp.q);
  const status = STATUSES.find((s) => s === str(sp.status));
  const date = str(sp.date);
  const { rows, count, page, pageSize } = await listSales({ q, status, date, page: parsePage(sp.page) });

  return (
    <>
      <PageHeader title="Борлуулалт" description="POS-ийн бүх борлуулалт" />
      <FilterBar action="/admin/sales" resetHref={q || status || date ? "/admin/sales" : undefined}>
        <input name="q" defaultValue={q} placeholder="Дугаар, нэр, утас" aria-label="Хайх" className={`${inputClass} w-56`} />
        <Select name="status" defaultValue={status ?? ""} aria-label="Төлөв" className="w-48">
          <option value="">Бүх төлөв</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.admin.saleStatus[s]}
            </option>
          ))}
        </Select>
        <input type="date" name="date" defaultValue={date} aria-label="Огноо" className={inputClass} />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="Борлуулалт олдсонгүй" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>Дугаар</th>
              <th className={thClass}>Огноо</th>
              <th className={thClass}>Үйлчлүүлэгч</th>
              <th className={thClass}>Төлбөр</th>
              <th className={thClass}>Төлөв</th>
              <th className={`${thClass} text-right`}>Дүн</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-navy/[0.02]">
                <td className={tdClass}>
                  <Link href={`/admin/sales/${r.id}`} className="font-mono text-[12.5px] underline-offset-4 hover:underline">
                    {r.number ?? "—"}
                  </Link>
                </td>
                <td className={`${tdClass} text-navy/70`}>{r.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Ulaanbaatar", dateStyle: "short", timeStyle: "short" })}</td>
                <td className={tdClass}>{r.customer ? `${r.customer.name} · ${r.customer.phone}` : <span className="text-navy/45">—</span>}</td>
                <td className={tdClass}>{[...new Set(r.payments.map((p) => t.admin.payMethod[p.method]))].join(", ") || "—"}</td>
                <td className={tdClass}>
                  <Badge tone={saleStatusTone(r.status)}>{t.admin.saleStatus[r.status]}</Badge>
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {formatMNT(r.total)}
                  {r.refundedAmount > 0 && <span className="block text-[12px] text-red-700">−{formatMNT(r.refundedAmount)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pageSize={pageSize} total={count} basePath="/admin/sales" params={{ q, status, date }} />
    </>
  );
}
