import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AttendanceGrid } from "@/components/admin/payroll/AttendanceGrid";
import { PageHeader, SegmentedTabs, btnClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { addDays, ubDateKey } from "@/lib/time";
import { DayAttendance } from "@/components/admin/attendance/DayAttendance";
import { ScheduleVsActual } from "@/components/admin/attendance/ScheduleVsActual";
import { closeStaleSessions, dayAttendance, scheduleVsActual } from "@/server/modules/attendance/service";
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
  // "Явлаа" дараагүй сессийг тэр дор нь хаана (Vercel дээр worker байхгүй)
  await closeStaleSessions();
  // PROMPT 20: ирц бүрэн автомат — гар засвар зөвхөн ADMIN (тохиргоогоор унтардаг), бусад нь зөвхөн харна
  const payrollSettings = await getPayrollSettings();
  const canEdit = can(user.role, "attendance:write") && payrollSettings.attendanceAdminEdit;
  const canNote = can(user.role, "attendance:note");
  const sp = await searchParams;
  const today = ubDateKey();
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const { splitDay } = payrollSettings;
  const half = sp.half === "1" || sp.half === "2" ? (Number(sp.half) as 1 | 2) : Number(today.slice(8)) <= splitDay ? 1 : 2;
  const { from, to } = halfRange(month, half, splitDay);
  const view = sp.view === "day" ? "day" : sp.view === "compare" ? "compare" : "grid";
  const day = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const [grid, dayRows, compare] = await Promise.all([
    view === "grid" ? attendanceGrid(from, to) : null,
    view === "day" ? dayAttendance(day) : null,
    view === "compare" ? scheduleVsActual(from, to) : null,
  ]);
  const A = t.admin.payroll.att;
  const vq = view === "compare" ? "&view=compare" : "";
  const href = (m: string, h: 1 | 2) => `/admin/attendance?month=${m}&half=${h}${vq}`;
  const prev = half === 2 ? href(month, 1) : href(shiftMonth(month, -1), 2);
  const next = half === 1 ? href(month, 2) : href(shiftMonth(month, 1), 1);

  return (
    <>
      <PageHeader eyebrow={t.admin.nav.groups.payroll} title={A.title} description="Ирц зөвхөн ажилтны «Ирлээ / Явлаа» (байршлаар) товчоор автоматаар бүртгэгдэнэ. Менежер тайлбар бичнэ; гар засвар зөвхөн админ, шалтгаантай." />
      <SegmentedTabs
        className="mb-4"
        label="Харагдац"
        value={view}
        items={[
          { value: "day", label: "Өдрөөр (Ирлээ/Явлаа)", href: `/admin/attendance?view=day&date=${day}` },
          { value: "grid", label: "15 хоногоор (7 хоногийн цаг)", href: `/admin/attendance?month=${month}&half=${half}` },
          { value: "compare", label: "Хуваарь vs бодит", href: `/admin/attendance?month=${month}&half=${half}&view=compare` },
        ]}
      />
      {dayRows ? (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Link href={`/admin/attendance?view=day&date=${addDays(day, -1)}`} className={btnClass("secondary", "sm")} aria-label="Өмнөх өдөр"><ChevronLeft className="size-4" /></Link>
            <span className="min-w-28 text-center font-display text-[20px] font-semibold tabular-nums">{day}</span>
            <Link href={`/admin/attendance?view=day&date=${addDays(day, 1)}`} className={btnClass("secondary", "sm")} aria-label="Дараагийн өдөр"><ChevronRight className="size-4" /></Link>
          </div>
          <DayAttendance rows={dayRows} day={day} canNote={canNote} />
          <p className="mt-3 text-[13px] text-ink-soft">
            Цаг зөвхөн «Ирлээ/Явлаа»-аас автоматаар тооцогдоно. «Явлаа» дараагүй бол хуваарийн дуусах цагаар хаагдана (⚠). Тайлбар цагт нөлөөлөхгүй.
            {canEdit && " Бодит алдаа гарвал (утас эвдэрсэн г.м.) админ «15 хоногоор» харагдацаас шалтгаантай засна."}
          </p>
        </>
      ) : (
      <>
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
      {compare ? <ScheduleVsActual rows={compare} /> : <AttendanceGrid days={grid!.days} rows={grid!.rows} holidays={grid!.holidays} lockedDays={grid!.lockedDays} canEdit={canEdit} />}
      </>
      )}
    </>
  );
}
