import { AlertTriangle, ChevronRight, Inbox, Receipt } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Breakdown } from "@/components/admin/reports/Breakdown";
import { CsvButton } from "@/components/admin/reports/CsvButton";
import { DailyChart } from "@/components/admin/reports/DailyChart";
import { RangePicker } from "@/components/admin/reports/RangePicker";
import { ReportTabs } from "@/components/admin/reports/ReportTabs";
import { SendToAccountant } from "@/components/admin/accountant/SendToAccountant";
import { LaunchButton } from "@/components/admin/system/LaunchButton";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { formatTime, ubDateKey } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { todayAppointmentStats } from "@/server/modules/appointments/queries";
import { countNewInquiries } from "@/server/modules/inquiries/service";
import { failedEmailCount } from "@/server/modules/outbox/monitor";
import { change, presetRange, previousRange, rangeFromParams } from "@/server/modules/reports/definitions";
import { loadReport } from "@/server/modules/reports/queries";
import { rangeBounds } from "@/server/modules/reports/definitions";
import { apptSourceBreakdown } from "@/server/modules/appointments/calendar-stats";
import { readiness } from "@/server/modules/system/readiness";

export const metadata = { title: "Тайлан" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

const R = t.admin.report;
const D = t.admin.dashboard;

type Sp = Promise<{ from?: string; to?: string; preset?: string }>;

export default async function ReportPage({ searchParams }: { searchParams: Sp }) {
  const user = await requireUser();
  if (!can(user.role, "schedule:all")) redirect("/admin/schedule");
  const canCost = can(user.role, "cost:read");
  const { range, preset } = rangeFromParams(await searchParams);

  const lowStockWhere = { isActive: true, stock: { lte: db.variant.fields.lowStockAt } };
  const [report, prev, ready, newInquiries, failedEmails, lowList, appts, sources] = await Promise.all([
    loadReport(range, { canCost }),
    loadReport(previousRange(range), { canCost: false }),
    can(user.role, "settings:write") ? readiness() : null,
    can(user.role, "inquiry:manage") ? countNewInquiries() : null,
    failedEmailCount(),
    db.variant.findMany({
      where: lowStockWhere,
      orderBy: { stock: "asc" },
      take: 5,
      select: { id: true, size: true, stock: true, lowStockAt: true, product: { select: { name: true } } },
    }),
    can(user.role, "appointment:read") ? todayAppointmentStats() : null,
    can(user.role, "appointment:read") ? apptSourceBreakdown(rangeBounds(range)) : null,
  ]);
  const sourceTotal = sources?.reduce((s, x) => s + x.count, 0) ?? 0;
  const k = report.kpi;
  const p = prev.kpi;
  const pct = (part: number) => (k.total > 0 ? Math.round((part / k.total) * 100) : 0);
  const missing = ready && !ready.launchedAt ? ready.items.filter((i) => !i.ok) : [];
  const payTotal = report.payments.reduce((s, x) => s + x.amount, 0);
  const presets = { today: presetRange("today"), week: presetRange("week"), month: presetRange("month"), lastMonth: presetRange("lastMonth") };
  const today = ubDateKey();

  return (
    <>
      {/* Launch readiness — ADMIN, one line until everything is done */}
      {missing.length > 0 && (
        <details className="group mb-6 rounded-2xl border border-warn/30 bg-warn-bg">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 text-[15px] text-warn">
            <AlertTriangle className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="flex-1">{R.readiness(missing.length)}</span>
            <span className="font-medium underline underline-offset-4">{R.readinessShow}</span>
          </summary>
          <ul className="space-y-1 border-t border-warn/20 px-5 py-3 text-[14px]" data-testid="readiness">
            {ready!.items.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-3">
                <Link href={i.href} className="hover:underline">
                  {i.label}
                  {i.detail && !i.ok && <span className="ml-2 text-[13px] text-danger">{i.detail}</span>}
                </Link>
                <Badge tone={i.ok ? "green" : "red"}>{i.ok ? D.done : D.missing}</Badge>
              </li>
            ))}
          </ul>
        </details>
      )}
      {ready && ready.ready && !ready.launchedAt && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-white px-5 py-3 text-[15px]">
          {D.readyAll}
          <LaunchButton />
        </div>
      )}
      {failedEmails > 0 && (
        <p role="alert" className="mb-6 flex flex-wrap items-center gap-x-2 rounded-xl bg-err-bg px-4 py-3 text-[15px] text-err">
          <AlertTriangle className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
          {D.failedEmails(failedEmails)}
          {can(user.role, "settings:write") ? (
            <Link href="/admin/system" className="font-medium underline underline-offset-4">
              {D.retryEmails}
            </Link>
          ) : (
            D.tellAdmin
          )}
        </p>
      )}

      {can(user.role, "report:read") && (
        <div className="mb-5">
          <ReportTabs active="overview" from={range.from} to={range.to} showPayroll={can(user.role, "payroll:read")} />
        </div>
      )}
      <PageHeader
        eyebrow={R.eyebrow}
        title={R.title}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <RangePicker from={range.from} to={range.to} preset={preset} presets={presets} />
            {can(user.role, "report:send") && <SendToAccountant defaultDay={range.to > today ? today : range.to} maxDay={today} />}
          </div>
        }
      />

      {/* KPI row 1 — the money */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <Kpi dark label={R.total} value={formatMNT(k.total)} hint={R.totalHint(k.sales)} title={R.netTitle(formatMNT(k.net))} delta={change(k.total, p.total)} big />
        <Kpi
          label={R.service}
          value={formatMNT(k.service)}
          hint={R.serviceHint(k.serviceQty, pct(k.service))}
          sub={R.serviceSplit(formatMNT(k.serviceOneTime), formatMNT(k.serviceCourse))}
          delta={change(k.service, p.service)}
          big
        />
        <Kpi label={R.product} value={formatMNT(k.product)} hint={R.productHint(k.productQty, pct(k.product))} delta={change(k.product, p.product)} big />
        <Kpi accent label={R.pending} value={formatMNT(k.pending)} hint={R.pendingHint(k.pendingCount)} big />
      </div>
      {/* KPI row 2 */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={R.sales} value={k.sales} delta={change(k.sales, p.sales)} />
        <Kpi label={R.average} value={formatMNT(k.average)} delta={change(k.average, p.average)} />
        <Kpi label={R.refunds} value={formatMNT(k.refunds)} hint={R.refundsHint(k.refundCount)} delta={change(k.refunds, p.refunds)} upIsBad />
        <Kpi label={R.done} value={k.done} delta={change(k.done, p.done)} />
        <Kpi label={R.noShow} value={k.noShow} delta={change(k.noShow, p.noShow)} upIsBad />
        <Kpi label={R.cancelled} value={k.cancelled} delta={change(k.cancelled, p.cancelled)} upIsBad />
      </div>

      {/* Chart 60 / breakdown 40 */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {k.total === 0 && k.sales === 0 ? (
          <EmptyState
            icon={Receipt}
            title={R.empty}
            action={
              can(user.role, "pos:use") && (
                <ButtonLink href="/admin/pos">{R.takePayment}</ButtonLink>
              )
            }
          >
            {R.emptyHint}
          </EmptyState>
        ) : (
          <DailyChart days={report.days} />
        )}
        <Breakdown byService={report.byService} byStaff={report.byStaff} byProduct={report.byProduct} />
      </div>

      {sources && sourceTotal > 0 && (
        <Card title="Цагийн эх сурвалж" description="Сонгосон хугацааны цагууд (цуцлагдсаныг оруулаагүй) — утас, Instagram, онлайн…" className="mt-6">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((x) => (
              <li key={x.source}>
                <div className="flex justify-between gap-3 text-[15px]">
                  <span>{t.admin.apptSource[x.source] ?? x.source}</span>
                  <span className="tabular-nums">{x.count} <span className="text-ink-soft">· {Math.round((x.count / sourceTotal) * 100)}%</span></span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-ink/[0.06]">
                  <div className={`h-full rounded-full ${x.source === "ONLINE" ? "bg-navy" : "bg-champagne"}`} style={{ width: `${Math.max(1, (x.count / sourceTotal) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Bottom row */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={R.payments}>
          {report.payments.length === 0 ? (
            <p className="text-[15px] text-ink-soft">{R.noPayments}</p>
          ) : (
            <ul className="space-y-3">
              {report.payments.map((x) => (
                <li key={x.method}>
                  <div className="flex justify-between gap-3 text-[15px]">
                    <span>{t.admin.payMethod[x.method]}</span>
                    <span className="tabular-nums">
                      {formatMNT(x.amount)} <span className="text-ink-soft">· {payTotal ? Math.round((x.amount / payTotal) * 100) : 0}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-ink/[0.06]">
                    <div className="h-full rounded-full bg-champagne" style={{ width: `${payTotal ? Math.max(1, (x.amount / payTotal) * 100) : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={R.lowStock} actions={<MoreLink href="/admin/inventory?low=1" label={R.allStock} />}>
          {lowList.length === 0 ? (
            <p className="text-[15px] text-ink-soft">{t.admin.dashboard.lowStockHint}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {lowList.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
                  <Link href={`/admin/inventory/${v.id}`} className="min-w-0 truncate hover:underline">
                    {v.product.name} <span className="text-ink-soft">· {v.size}</span>
                  </Link>
                  <Badge tone="red">{v.stock}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
        {appts && (
          <Card title={R.nextAppts} actions={<MoreLink href="/admin/calendar" label={R.openCalendar} />}>
            {appts.next.length === 0 ? (
              <p className="text-[15px] text-ink-soft">{R.noNext}</p>
            ) : (
              <ol className="divide-y divide-hairline">
                {appts.next.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5 text-[15px]">
                    <span className="w-12 font-semibold tabular-nums">{formatTime(a.startsAt)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {a.customer.name} <span className="text-ink-soft">· {a.service.name}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}
            {newInquiries !== null && (
              <Link
                href="/admin/inquiries?status=NEW"
                className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-[15px] font-medium ${newInquiries > 0 ? "border-champagne/50 bg-champagne/15 text-[#6f5733]" : "border-hairline bg-white text-ink-soft hover:text-ink"}`}
              >
                <Inbox className="size-[18px]" strokeWidth={1.75} aria-hidden />
                {t.admin.inquiries.newCard(newInquiries)}
              </Link>
            )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-[860px] text-[13px] text-ink-soft">{R.footnote}</p>
        <CsvButton report={report} />
      </div>
    </>
  );
}

function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[14px] font-medium text-ink-soft hover:text-ink">
      {label} <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

/** KPI tile; first one dark navy, "Хүлээгдэж буй" with a champagne border; ▲/▼ vs the previous period */
function Kpi({ label, value, hint, sub, delta, dark, accent, big, upIsBad, title }: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Нэмэлт задаргааны мөр (A12: нэг удаагийн / курс) */
  sub?: string;
  delta?: number | null;
  dark?: boolean;
  accent?: boolean;
  big?: boolean;
  upIsBad?: boolean;
  title?: string;
}) {
  const good = delta != null && delta !== 0 && (delta > 0) !== Boolean(upIsBad);
  return (
    <div
      title={title}
      className={`rounded-2xl border p-5 ${dark ? "border-navy bg-navy text-white" : accent ? "border-champagne/60 bg-[#FBF8F3]" : "border-hairline bg-white"}`}
    >
      <p className={`text-[14px] ${dark ? "text-white/70" : "text-ink-soft"}`}>{label}</p>
      <p className={`mt-2 font-display font-bold leading-none tabular-nums ${big ? "text-[34px]" : "text-[26px]"}`}>{value}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {hint && <span className={`text-[13px] ${dark ? "text-white/65" : "text-ink-soft"}`}>{hint}</span>}
        {delta != null && delta !== 0 && (
          <span
            title={R.vsPrev}
            className={`text-[13px] font-medium tabular-nums ${dark ? (good ? "text-[#9fd4ad]" : "text-[#f2b8b0]") : good ? "text-ok" : "text-err"}`}
          >
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sub && <p className={`mt-1.5 text-[13px] ${dark ? "text-white/65" : "text-ink-soft"}`}>{sub}</p>}
    </div>
  );
}
