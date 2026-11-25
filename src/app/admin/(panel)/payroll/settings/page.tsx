import { PayrollModeForm } from "@/components/admin/payroll/PayrollModeForm";
import { RateSetList, type RateSetRow } from "@/components/admin/payroll/RateSetList";
import { Card, PageHeader } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateTime, ubDateKey } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { listRateSets } from "@/server/modules/payroll/rates";
import { getPayrollSettings } from "@/server/modules/payroll/settings";

export const metadata = { title: "Цалингийн тохиргоо" };
export const instant = false;

export default async function PayrollSettingsPage() {
  await requirePagePermission("payroll:settings");
  const [sets, settings] = await Promise.all([listRateSets(), getPayrollSettings()]);
  const today = ubDateKey();
  const currentId = sets.find((s) => s.effectiveFrom <= today)?.id;
  const rows: RateSetRow[] = sets.map((s) => ({
    id: s.id,
    effectiveFrom: s.effectiveFrom,
    employeeSiBp: s.employeeSiBp,
    employerRates: s.employerRates,
    siBreakdown: s.siBreakdown,
    siCap: s.siCap,
    pitBp: s.pitBp,
    pitCredits: s.pitCredits,
    note: s.note,
    confirmedAt: s.confirmedAt ? formatDateTime(s.confirmedAt) : null,
    confirmedBy: s.confirmedBy?.name ?? null,
    status: s.id === currentId ? "current" : s.effectiveFrom > today ? "future" : "past",
  }));
  const R = t.admin.payroll.rates;
  return (
    <>
      <PageHeader eyebrow={t.admin.nav.groups.payroll} title={R.title} description={R.description} />
      <div className="space-y-6">
        <RateSetList sets={rows} canEdit />
        <Card title={R.mode}>
          <PayrollModeForm initial={settings} />
        </Card>
      </div>
    </>
  );
}
