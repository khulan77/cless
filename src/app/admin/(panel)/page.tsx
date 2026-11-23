import { AlertTriangle, Boxes, CalendarCheck, Inbox, UserCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LaunchButton } from "@/components/admin/system/LaunchButton";
import { Avatar, Badge, Card, PageHeader, StatCard } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { formatDateTime, formatTime } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { todayAppointmentStats } from "@/server/modules/appointments/queries";
import { countNewInquiries } from "@/server/modules/inquiries/service";
import { workerStatus } from "@/server/modules/outbox/heartbeat";
import { failedEmailCount } from "@/server/modules/outbox/monitor";
import { todaySummary } from "@/server/modules/sales/queries";
import { readiness } from "@/server/modules/system/readiness";

export const metadata = { title: "Хянах самбар" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

const D = t.admin.dashboard;

export default async function DashboardPage() {
  const user = await requireUser();
  if (!can(user.role, "schedule:all")) redirect("/admin/schedule");

  const lowStockWhere = { isActive: true, stock: { lte: db.variant.fields.lowStockAt } };
  const [lowCount, lowList, sales, appts, worker, failedEmails, ready, newInquiries] = await Promise.all([
    db.variant.count({ where: lowStockWhere }),
    db.variant.findMany({
      where: lowStockWhere,
      orderBy: { stock: "asc" },
      take: 6,
      select: { id: true, sku: true, size: true, stock: true, lowStockAt: true, product: { select: { name: true } } },
    }),
    can(user.role, "sale:read") ? todaySummary() : null,
    can(user.role, "appointment:read") ? todayAppointmentStats() : null,
    workerStatus(),
    failedEmailCount(),
    can(user.role, "settings:write") ? readiness() : null,
    can(user.role, "inquiry:manage") ? countNewInquiries() : null,
  ]);
  const allReady = ready?.ready ?? false;

  return (
    <>
      <PageHeader
        eyebrow="Тойм"
        title={D.greeting(user.name)}
        description={D.subtitle}
        actions={
          newInquiries !== null && (
            <Link
              href="/admin/inquiries?status=NEW"
              className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-[15px] font-medium transition-colors ${newInquiries > 0 ? "border-champagne/50 bg-champagne/15 text-[#6f5733] hover:bg-champagne/25" : "border-hairline bg-white text-ink-soft hover:text-ink"}`}
            >
              <Inbox className="size-[18px]" strokeWidth={1.75} aria-hidden />
              {t.admin.inquiries.newCard(newInquiries)}
            </Link>
          )
        }
      />

      {/* One-line notices — only when something needs attention */}
      <div className="mb-6 space-y-2 empty:hidden">
        {failedEmails > 0 && (
          <p role="alert" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-err-bg px-4 py-3 text-[15px] text-err">
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
        {worker.stale && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-warn-bg px-4 py-3 text-[15px] text-warn">
            <AlertTriangle className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
            {worker.minutesAgo === null ? D.senderNever : D.senderStale(worker.minutesAgo)}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sales && <StatCard tone="dark" icon={Wallet} label={D.revenue} value={formatMNT(sales.revenue)} hint={D.salesHint(sales.salesCount)} href="/admin/sales" />}
        {appts && (
          <StatCard
            icon={CalendarCheck}
            label={D.appointments}
            value={appts.total}
            hint={appts.noShow ? D.noShow(appts.noShow) : D.openCalendar}
            href="/admin/calendar"
            tone={appts.noShow > 0 ? "alert" : "default"}
          />
        )}
        {sales && <StatCard icon={UserCheck} label={D.visits} value={sales.visits} hint={D.visitsHint} />}
        <StatCard icon={Boxes} label={D.lowStock} value={lowCount} hint={D.lowStockHint} href="/admin/inventory?low=1" tone={lowCount > 0 ? "alert" : "default"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {appts && (
          <Card title={D.nextTitle} actions={<Link href="/admin/calendar" className="text-[14px] font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline">{D.openCalendar}</Link>}>
            {appts.next.length === 0 ? (
              <p className="py-4 text-[15px] text-ink-soft">{D.noNext}</p>
            ) : (
              <ol className="divide-y divide-hairline">
                {appts.next.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 py-3">
                    <span className="w-14 font-display text-[22px] font-semibold tabular-nums">{formatTime(a.startsAt)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{a.customer.name}</p>
                      <p className="truncate text-[14px] text-ink-soft">{a.service.name}</p>
                    </div>
                    <span className="hidden items-center gap-2 text-[14px] text-ink-soft sm:flex">
                      <Avatar name={a.staff.name} size={28} />
                      {a.staff.name}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}

        {sales && (
          <Card title={D.topTitle} actions={<Link href="/admin/sales" className="text-[14px] font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline">{D.allSales}</Link>}>
            <p className="mb-3 text-[14px] text-ink-soft">{sales.byMethod.map((m) => `${t.admin.payMethod[m.method]}: ${formatMNT(m.amount)}`).join(" · ") || D.noPayments}</p>
            {sales.top.length === 0 ? (
              <p className="py-2 text-[15px] text-ink-soft">{D.noSales}</p>
            ) : (
              <ol className="divide-y divide-hairline">
                {sales.top.map((x, i) => (
                  <li key={x.name} className="flex justify-between gap-3 py-2.5 text-[15px]">
                    <span className="min-w-0 truncate">
                      <span className="text-ink-faint">{i + 1}.</span> {x.name} <span className="text-ink-soft">× {x.qty}</span>
                    </span>
                    <span className="tabular-nums">{formatMNT(x.amount)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}
      </div>

      {lowList.length > 0 && (
        <Card title={D.lowTitle} className="mt-6" actions={<Link href="/admin/inventory?low=1" className="text-[14px] font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline">{D.allStock}</Link>}>
          <ul className="divide-y divide-hairline">
            {lowList.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-3 text-[15px]">
                <span className="min-w-0">
                  <Link href={`/admin/inventory/${v.id}`} className="font-medium hover:underline">
                    {v.product.name}
                  </Link>{" "}
                  <span className="text-ink-soft">· {v.size}</span>
                  <span className="block text-[13px] text-ink-faint">
                    {t.admin.productCode}: {v.sku}
                  </span>
                </span>
                <Badge tone="red">{D.leftOf(v.stock, v.lowStockAt)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Launch readiness — ADMIN only; folds away once everything is done */}
      {ready && !ready.launchedAt && (
        <details open={!allReady} className="group mt-6 rounded-2xl border border-hairline bg-white">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-6 py-5">
            <span>
              <span className="block font-display text-[22px] font-semibold">{t.admin.readiness.title}</span>
              <span className="block text-[14px] text-ink-soft">
                {allReady ? D.readyAll : D.readyLeft(ready.items.filter((i) => !i.ok).length)}
              </span>
            </span>
            {allReady && <LaunchButton />}
          </summary>
          <ul className="divide-y divide-hairline border-t border-hairline px-6" data-testid="readiness">
            {ready.items.map((i) => (
              <li key={i.key} className="flex items-start justify-between gap-3 py-3">
                <span className="min-w-0 text-[15px]">
                  <Link href={i.href} className="hover:underline">
                    {i.label}
                  </Link>
                  {i.detail && <span className={`block text-[13px] ${i.ok ? "text-ink-soft" : "text-danger"}`}>{i.detail}</span>}
                </span>
                <Badge tone={i.ok ? "green" : "red"}>{i.ok ? D.done : D.missing}</Badge>
              </li>
            ))}
          </ul>
          <p className="border-t border-hairline px-6 py-3 text-[13px] text-ink-soft">{t.admin.readiness.hint}</p>
        </details>
      )}
      {ready?.launchedAt && <p className="mt-6 text-[13px] text-ink-faint">{t.admin.readiness.launched(formatDateTime(new Date(ready.launchedAt)))}</p>}
    </>
  );
}
