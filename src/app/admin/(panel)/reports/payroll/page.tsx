import { ReportTabs } from "@/components/admin/reports/ReportTabs";
import { EmptyState, PageHeader, SegmentedTabs, Table, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { ubDateKey } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { payrollReport } from "@/server/modules/payroll/report";
import { presetRange } from "@/server/modules/reports/definitions";
import { HandCoins } from "lucide-react";

export const metadata = { title: "Цалин — Тайлан" };
export const instant = false;

const pct = (r: number | null) => (r === null ? "—" : `${(r * 100).toFixed(1)}%`);

export default async function PayrollReportPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await requirePagePermission("payroll:read");
  const thisYear = Number(ubDateKey().slice(0, 4));
  const raw = Number((await searchParams).year);
  const year = Number.isInteger(raw) && raw > 2000 && raw <= thisYear + 1 ? raw : thisYear;
  const r = await payrollReport(year);
  const R = t.admin.payroll.report;
  const C = t.admin.payroll.col;
  const month = presetRange("month");
  const max = Math.max(1, ...r.byMonth.map((m) => m.cost));

  return (
    <>
      <div className="mb-5">
        <ReportTabs active="payroll" from={month.from} to={month.to} showPayroll />
      </div>
      <PageHeader
        eyebrow={t.admin.report.title}
        title={R.title}
        description={`${R.description} ${R.onlyApproved}`}
        actions={<SegmentedTabs label={t.admin.payroll.hol.year} value={String(year)} items={[thisYear - 1, thisYear].map((y) => ({ value: String(y), label: String(y), href: `/admin/reports/payroll?year=${y}` }))} />}
      />
      {r.byMonth.length === 0 ? (
        <EmptyState icon={HandCoins} title={R.empty} />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [R.cost, formatMNT(r.totals.cost)],
              [R.serviceRevenue, formatMNT(r.totals.service)],
              [R.ratio, pct(r.totals.ratio)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-hairline bg-white p-5">
                <p className="text-[14px] text-ink-soft">{k}</p>
                <p className="mt-2 font-display text-[28px] font-semibold tabular-nums leading-none">{v}</p>
              </div>
            ))}
          </div>

          <section>
            <h2 className="mb-3 font-display text-[22px] font-semibold">{R.byMonth}</h2>
            <Table>
              <thead>
                <tr>
                  <th className={thClass}>{t.admin.payroll.periods.month}</th>
                  <th className={`${thClass} text-right`}>{C.gross}</th>
                  <th className={`${thClass} text-right`}>{C.er}</th>
                  <th className={`${thClass} text-right`}>{R.cost}</th>
                  <th className={`${thClass} w-48`}><span className="sr-only">{R.cost}</span></th>
                  <th className={`${thClass} text-right`}>{R.serviceRevenue}</th>
                  <th className={`${thClass} text-right`}>{R.ratio}</th>
                </tr>
              </thead>
              <tbody>
                {r.byMonth.map((m) => (
                  <tr key={m.month}>
                    <td className={`${tdClass} tabular-nums`}>{m.month}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(m.gross)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(m.siEmployer)}</td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums`}>{formatMNT(m.cost)}</td>
                    <td className={tdClass}>
                      <div className="h-2.5 rounded-full bg-canvas" aria-hidden>
                        <div className="h-2.5 rounded-full bg-navy" style={{ width: `${Math.round((m.cost / max) * 100)}%` }} />
                      </div>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(m.service)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{pct(m.ratio)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>

          <section>
            <h2 className="mb-3 font-display text-[22px] font-semibold">{R.byStaff}</h2>
            <Table>
              <thead>
                <tr>
                  <th className={thClass}>{C.staff}</th>
                  <th className={`${thClass} text-right`}>{C.gross}</th>
                  <th className={`${thClass} text-right`}>{C.er}</th>
                  <th className={`${thClass} text-right`}>{R.cost}</th>
                  <th className={`${thClass} text-right`}>{C.net}</th>
                </tr>
              </thead>
              <tbody>
                {r.byStaff.map((s) => (
                  <tr key={s.name}>
                    <td className={tdClass}>{s.name}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(s.gross)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(s.siEmployer)}</td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums`}>{formatMNT(s.cost)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(s.net)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>
        </div>
      )}
    </>
  );
}
