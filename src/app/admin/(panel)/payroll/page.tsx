import Link from "next/link";
import { OpenMonthForm } from "@/components/admin/payroll/OpenMonthForm";
import { PERIOD_TONE } from "@/components/admin/payroll/tones";
import { Badge, Card, EmptyState, PageHeader, Table, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { ubDateKey } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { requireFinancePage } from "@/server/modules/finance/access";
import { listPeriods } from "@/server/modules/payroll/periods";
import { getPayrollSettings } from "@/server/modules/payroll/settings";
import { HandCoins } from "lucide-react";

export const metadata = { title: "Цалингийн үе" };
export const instant = false;

export default async function PayrollPage() {
  // MANAGER — тохиргоогоор зөвхөн харах (PROMPT 19); бичих товч payroll:write-ээр
  const { user } = await requireFinancePage("payroll");
  const [periods, settings] = await Promise.all([listPeriods(), getPayrollSettings()]);
  const P = t.admin.payroll;
  return (
    <>
      <PageHeader eyebrow={P.periods.month} title={P.periods.title} description={P.periods.description} />
      {can(user.role, "payroll:write") && (
        <Card className="mb-6" description={P.periods.modeHint[settings.mode]}>
          <OpenMonthForm defaultMonth={ubDateKey().slice(0, 7)} />
        </Card>
      )}
      {periods.length === 0 ? (
        <EmptyState icon={HandCoins} title={P.periods.empty} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>{P.periods.period}</th>
              <th className={thClass}>{P.periods.kind}</th>
              <th className={thClass}>{t.admin.status}</th>
              <th className={`${thClass} text-right`}>{P.periods.lines}</th>
              <th className={`${thClass} text-right`}>{P.periods.gross}</th>
              <th className={`${thClass} text-right`}>{P.periods.net}</th>
              <th className={`${thClass} text-right`}>{P.periods.siEmployer}</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="hover:bg-canvas">
                <td className={tdClass}>
                  <Link href={`/admin/payroll/${p.id}`} className="font-medium tabular-nums hover:underline">{p.from} — {p.to}</Link>
                </td>
                <td className={tdClass}>{P.kind[p.kind]}</td>
                <td className={tdClass}>
                  <Badge tone={PERIOD_TONE[p.status]}>{P.status[p.status]}</Badge>
                  {p.status === "DRAFT" && !p.calculatedAt && <span className="ml-2 text-[13px] text-ink-soft">{P.period.notCalculated}</span>}
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>{p.lines}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(p.gross)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(p.net)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(p.siEmployer)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
