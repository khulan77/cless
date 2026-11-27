import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination, parsePage, str } from "@/components/admin/Pagination";
import { Receipt } from "lucide-react";
import { Badge, ButtonLink, EmptyState, PageHeader, SegmentedTabs, Select, StatCard, Table, inputClass, tdClass, thClass } from "@/components/admin/ui";
import { db } from "@/server/db";
import { ubDayRange } from "@/lib/time";
import { addDays, ubDateKey } from "@/lib/time";
import type { SaleStatus } from "@/generated/prisma/client";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { saleStatusTone } from "@/lib/sale-status";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { listSales } from "@/server/modules/sales/queries";

export const metadata = { title: "Борлуулалт" };
export const instant = false;

const STATUSES = Object.keys(t.admin.saleStatus) as SaleStatus[];

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission("sale:read");
  const sp = await searchParams;
  const q = str(sp.q);
  const status = STATUSES.find((s) => s === str(sp.status));
  const today = ubDateKey();
  const PERIODS = { all: undefined, today: today, week: addDays(today, -6), month: `${today.slice(0, 8)}01` } as const;
  type Period = keyof typeof PERIODS;
  const period: Period = (["today", "week", "month"] as const).find((x) => x === sp.period) ?? "all";
  const date = str(sp.date);
  const from = !date && period !== "all" ? PERIODS[period] : undefined;
  // KPI for the chosen period (read-only aggregate; drafts and cancelled sales excluded)
  const range = date
    ? ubDayRange(new Date(`${date}T12:00:00+08:00`))
    : from
      ? { start: ubDayRange(new Date(`${from}T12:00:00+08:00`)).start, end: undefined }
      : null;
  const createdAt = range ? { gte: range.start, ...(range.end ? { lt: range.end } : {}) } : undefined;
  const [{ rows, count, page, pageSize }, done, pending] = await Promise.all([
    listSales({ q, status, date, from, page: parsePage(sp.page) }),
    db.sale.aggregate({
      where: { createdAt, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      _count: true,
      _sum: { total: true, refundedAmount: true },
    }),
    db.sale.aggregate({ where: { createdAt, status: { in: ["PENDING_PAYMENT", "PARTIALLY_PAID"] } }, _count: true, _sum: { total: true, paidAmount: true } }),
  ]);
  const revenue = (done._sum.total ?? 0) - (done._sum.refundedAmount ?? 0);
  const owed = (pending._sum.total ?? 0) - (pending._sum.paidAmount ?? 0);
  const periodHref = (p: Period) => {
    const x = new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(p !== "all" && { period: p }) }).toString();
    return x ? `/admin/sales?${x}` : "/admin/sales";
  };

  return (
    <>
      <PageHeader
        eyebrow="Касс"
        title="Борлуулалт"
        description="Касс дээр хийгдсэн бүх борлуулалт, төлбөр, буцаалт"
        actions={
          <SegmentedTabs
            label="Хугацаа"
            value={date ? "all" : period}
            items={[
              { value: "today", label: "Өнөөдөр", href: periodHref("today") },
              { value: "week", label: "7 хоног", href: periodHref("week") },
              { value: "month", label: "Энэ сар", href: periodHref("month") },
              { value: "all", label: "Бүгд", href: periodHref("all") },
            ]}
          />
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <StatCard tone="dark" label="Орсон орлого" value={formatMNT(revenue)} hint={`${done._count} төлөгдсөн борлуулалт`} />
        <StatCard label="Төлөгдөж дуусаагүй" value={formatMNT(owed)} hint={pending._count ? `${pending._count} борлуулалт` : "Хүлээгдэж буй төлбөр алга"} />
        <StatCard label="Борлуулалт" value={done._count} />
        <StatCard label="Дундаж дүн" value={formatMNT(done._count ? Math.round(revenue / done._count) : 0)} />
        <StatCard label="Буцаалт" value={formatMNT(done._sum.refundedAmount ?? 0)} tone={(done._sum.refundedAmount ?? 0) > 0 ? "alert" : "default"} />
      </div>
      <FilterBar action="/admin/sales" resetHref={q || status || date ? "/admin/sales" : undefined}>
        {period !== "all" && <input type="hidden" name="period" value={period} />}
        <input name="q" defaultValue={q} placeholder="Баримтын дугаар, нэр, утас" aria-label="Хайх" className={`${inputClass} w-72`} />
        <Select name="status" defaultValue={status ?? ""} aria-label="Төлөв" className="w-48">
          <option value="">Бүх төлөв</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.admin.saleStatus[s]}
            </option>
          ))}
        </Select>
        <input type="date" name="date" defaultValue={date} aria-label="Тодорхой өдөр" title="Тодорхой өдөр" className={inputClass} />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Энэ хугацаанд борлуулалт алга"
          action={can(user.role, "pos:use") ? <ButtonLink href="/admin/pos">Касс нээх (POS)</ButtonLink> : null}
        >
          Касс дээр төлбөр авахад энд харагдана.
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>Баримтын дугаар</th>
              <th className={thClass}>Огноо</th>
              <th className={thClass}>Үйлчлүүлэгч</th>
              <th className={thClass}>Төлбөр</th>
              <th className={thClass}>Төлөв</th>
              <th className={`${thClass} text-right`}>Дүн</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-canvas">
                <td className={tdClass}>
                  <Link href={`/admin/sales/${r.id}`} className="font-mono text-[13px] underline-offset-4 hover:underline">
                    {r.number ?? "Хадгалсан (төлөгдөөгүй)"}
                  </Link>
                </td>
                <td className={`${tdClass} text-ink-soft`}>{r.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Ulaanbaatar", dateStyle: "short", timeStyle: "short" })}</td>
                <td className={tdClass}>{r.customer ? `${r.customer.name} · ${r.customer.phone}` : <span className="text-ink-faint">—</span>}</td>
                <td className={tdClass}>{[...new Set(r.payments.map((p) => t.admin.payMethod[p.method]))].join(", ") || "—"}</td>
                <td className={tdClass}>
                  <Badge tone={saleStatusTone(r.status)}>{t.admin.saleStatus[r.status]}</Badge>
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {formatMNT(r.total)}
                  {r.refundedAmount > 0 && <span className="block text-[13px] text-danger">−{formatMNT(r.refundedAmount)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pageSize={pageSize} total={count} basePath="/admin/sales" params={{ q, status, date, period: period === "all" ? undefined : period }} />
    </>
  );
}
