import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AttendanceGrid } from "@/components/admin/payroll/AttendanceGrid";
import { PageHeader, SegmentedTabs, btnClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { ubDateKey } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { attendanceGrid } from "@/server/modules/payroll/attendance";
import { halfRange, shiftMonth } from "@/server/modules/payroll/ranges";
import { getPayrollSettings } from "@/server/modules/payroll/settings";

export const metadata = { title: "Ирц" };
export const instant = false;

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AttendancePage({ searchParams }: { searchParams: SP }) {
  const user = await requirePagePermission("attendance:read");
  const canEdit = can(user.role, "attendance:write");
  const sp = await searchParams;
  const today = ubDateKey();
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const { splitDay } = await getPayrollSettings();
  const half = sp.half === "1" || sp.half === "2" ? (Number(sp.half) as 1 | 2) : Number(today.slice(8)) <= splitDay ? 1 : 2;
  const { from, to } = halfRange(month, half, splitDay);
  const grid = await attendanceGrid(from, to);
  const A = t.admin.payroll.att;
  const href = (m: string, h: 1 | 2) => `/admin/attendance?month=${m}&half=${h}`;
  const prev = half === 2 ? href(month, 1) : href(shiftMonth(month, -1), 2);
  const next = half === 1 ? href(month, 2) : href(shiftMonth(month, 1), 1);

  return (
    <>
      <PageHeader eyebrow={t.admin.nav.groups.payroll} title={A.title} description={canEdit ? A.description : A.descriptionRead} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href={prev} className={btnClass("secondary", "sm")} aria-label={A.prev}><ChevronLeft className="size-4" /></Link>
        <span className="min-w-28 text-center font-display text-[20px] font-semibold tabular-nums">{month}</span>
        <Link href={next} className={btnClass("secondary", "sm")} aria-label={A.next}><ChevronRight className="size-4" /></Link>
        <SegmentedTabs
          label={t.admin.payroll.periods.period}
          value={String(half)}
          items={[
            { value: "1", label: A.half1(splitDay), href: href(month, 1) },
            { value: "2", label: A.half2(splitDay), href: href(month, 2) },
          ]}
        />
      </div>
      <AttendanceGrid days={grid.days} rows={grid.rows} holidays={grid.holidays} lockedDays={grid.lockedDays} canEdit={canEdit} />
    </>
  );
}
