import Link from "next/link";
import { MeTabs } from "@/components/admin/me/MeTabs";
import { AttendanceGrid } from "@/components/admin/payroll/AttendanceGrid";
import { PERIOD_TONE } from "@/components/admin/payroll/tones";
import { Badge, Card, PageHeader, Table, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { ubDateKey } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { attendanceGrid } from "@/server/modules/payroll/attendance";
import { myPayslips } from "@/server/modules/payroll/periods";
import { halfRange } from "@/server/modules/payroll/ranges";
import { getPayrollSettings } from "@/server/modules/payroll/settings";

export const metadata = { title: "Миний цалин" };
export const instant = false;

/** Гоо сайханч: зөвхөн БАТЛАГДСАН өөрийн цалингийн хуудас (ноорог харагдахгүй) + энэ хагасын ирц (зөвхөн харах) */
export default async function MyPayrollPage() {
  const user = await requirePagePermission("me:read");
  const today = ubDateKey();
  const { splitDay } = await getPayrollSettings();
  const { from, to } = halfRange(today.slice(0, 7), Number(today.slice(8)) <= splitDay ? 1 : 2, splitDay);
  const [slips, grid] = await Promise.all([myPayslips(user.id), attendanceGrid(from, to, { staffId: user.id })]);
  const P = t.admin.payroll;
  return (
    <>
      <div className="mb-5"><MeTabs active="payroll" /></div>
      <PageHeader title={P.me.title} description={P.me.description} />
      <Card title={P.me.title} className="mb-6" flush>
        {slips.length === 0 ? (
          <p className="px-6 pb-6 text-[15px] text-ink-soft">{P.me.empty}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>{P.periods.period}</th>
                <th className={thClass}>{P.periods.kind}</th>
                <th className={`${thClass} text-right`}>{P.col.gross}</th>
                <th className={`${thClass} text-right`}>{P.col.net}</th>
                <th className={thClass}>{t.admin.status}</th>
              </tr>
            </thead>
            <tbody>
              {slips.map((s) => (
                <tr key={s.id} className="hover:bg-canvas">
                  <td className={tdClass}>
                    <Link href={`/admin/me/payroll/${s.periodId}`} className="font-medium tabular-nums hover:underline">{s.from} — {s.to}</Link>
                  </td>
                  <td className={tdClass}>{P.kind[s.period.kind]}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(s.gross)}</td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums`}>{formatMNT(s.net)}</td>
                  <td className={tdClass}><Badge tone={PERIOD_TONE[s.period.status]}>{P.status[s.period.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <h2 className="mb-3 font-display text-[22px] font-semibold">{P.att.mine} · <span className="tabular-nums">{from} — {to}</span></h2>
      <AttendanceGrid days={grid.days} rows={grid.rows} holidays={grid.holidays} lockedDays={grid.lockedDays} canEdit={false} />
    </>
  );
}
