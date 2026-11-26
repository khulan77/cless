import { AlertTriangle, Info } from "lucide-react";
import { notFound } from "next/navigation";
import { AdjustmentsPanel } from "@/components/admin/payroll/AdjustmentsPanel";
import { PeriodActions } from "@/components/admin/payroll/PeriodActions";
import { PeriodLines, type LineView } from "@/components/admin/payroll/PeriodLines";
import { PERIOD_TONE } from "@/components/admin/payroll/tones";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateTime } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { requireFinancePage } from "@/server/modules/finance/access";
import { payrollStaff } from "@/server/modules/payroll/attendance";
import { getPeriod } from "@/server/modules/payroll/periods";
import { getPayrollSettings } from "@/server/modules/payroll/settings";

export const metadata = { title: "Цалингийн үе" };
export const instant = false;

export default async function PayrollPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  // MANAGER — тохиргоогоор зөвхөн харах (PROMPT 19); бичих товч payroll:write-ээр
  const { user } = await requireFinancePage("payroll");
  const { id } = await params;
  const [p, settings, staff] = await Promise.all([getPeriod(id), getPayrollSettings(), payrollStaff()]);
  if (!p) notFound();
  const P = t.admin.payroll;
  const canWrite = can(user.role, "payroll:write");
  const withhold = p.kind !== "ADVANCE" || settings.advanceWithholding;
  const info = p.kind === "ADVANCE" ? (settings.advanceWithholding ? P.period.advanceWithholdInfo : P.period.advanceInfo) : p.kind === "FINAL" ? P.period.finalInfo : P.period.fullInfo;
  const lines: LineView[] = p.lines.map((l) => ({
    id: l.id,
    staffId: l.staffId,
    name: l.staff.name,
    plannedDays: l.plannedDays,
    workedDays: l.workedDays,
    baseSalary: l.baseSalary,
    serviceCommission: l.serviceCommission,
    productCommission: l.productCommission,
    adjustments: l.adjustments,
    deductions: l.deductions,
    gross: l.gross,
    siEmployee: l.siEmployee,
    pit: l.pit,
    siEmployer: l.siEmployer,
    advancePaid: l.advancePaid,
    net: l.net,
    details: l.details,
  }));

  return (
    <>
      <PageHeader
        eyebrow={`${P.periods.title} · ${P.kind[p.kind]}`}
        title={`${p.from} — ${p.to}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={PERIOD_TONE[p.status]}>{P.status[p.status]}</Badge>
            {p.approvedBy && p.approvedAt && <span>{P.period.approvedBy(p.approvedBy.name, formatDateTime(p.approvedAt))}</span>}
            {p.status === "DRAFT" && !p.calculatedAt && p.lines.length > 0 && <Badge tone="red">{P.period.stale}</Badge>}
          </span>
        }
        actions={<PeriodActions id={p.id} status={p.status} calculated={!!p.calculatedAt} hasLines={p.lines.length > 0} canWrite={canWrite} />}
      />

      <div className="mb-5 space-y-3">
        <p className="flex gap-2 text-[14px] text-ink-soft"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />{info}</p>
        {withhold && !p.rateSet && (
          <p role="alert" className="flex gap-2 rounded-xl bg-err-bg px-4 py-3 text-[14px] text-err"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{P.period.ratesMissing}</p>
        )}
        {withhold && p.rateSet && !p.rateSet.confirmedAt && (
          <p role="alert" className="flex gap-2 rounded-xl bg-err-bg px-4 py-3 text-[14px] text-err"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{P.period.ratesUnconfirmed}</p>
        )}
        {withhold && p.rateSet?.confirmedAt && <p className="text-[13px] text-ink-soft">{P.period.ratesInfo(p.rateSet.effectiveFrom)}</p>}
        {p.status !== "DRAFT" && <p className="text-[13px] text-ink-soft">{P.period.lockedNote}</p>}
      </div>

      {lines.length === 0 ? (
        <Card><p className="text-[15px] text-ink-soft">{P.period.empty}</p></Card>
      ) : (
        <PeriodLines lines={lines} isFinal={p.kind === "FINAL"} slipBase={`/admin/payroll/${p.id}/slip/`} />
      )}

      <Card title={P.adj.add} className="mt-6">
        <AdjustmentsPanel
          periodId={p.id}
          canEdit={canWrite && p.status === "DRAFT"}
          staff={staff.map((s) => ({ id: s.id, name: s.name }))}
          items={p.adjustments.map((a) => ({ id: a.id, staff: a.staff.name, type: a.type, amount: a.amount, reason: a.reason }))}
        />
      </Card>
    </>
  );
}
