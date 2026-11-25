import { StaffPayrollCard } from "@/components/admin/payroll/StaffPayrollCard";
import { PageHeader } from "@/components/admin/ui";
import { t } from "@/i18n";
import { ubDateKey } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { rateSetFor } from "@/server/modules/payroll/rates";
import { staffPayrollInfo } from "@/server/modules/payroll/staff";

export const metadata = { title: "Ажилтны цалин" };
export const instant = false;

export default async function StaffPayrollPage() {
  await requirePagePermission("payroll:write");
  const today = ubDateKey();
  const [staff, rates] = await Promise.all([staffPayrollInfo(), rateSetFor(today)]);
  const S = t.admin.payroll.staff;
  return (
    <>
      <PageHeader eyebrow={t.admin.nav.groups.payroll} title={S.title} description={S.description} />
      <div className="space-y-4">
        {staff.map((s) => (
          <StaffPayrollCard key={s.id} s={s} today={today} categories={rates?.employerRates ?? []} />
        ))}
      </div>
    </>
  );
}
