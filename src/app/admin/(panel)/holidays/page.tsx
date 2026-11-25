import Link from "next/link";
import { HolidayEditor } from "@/components/admin/payroll/HolidayEditor";
import { PageHeader, SegmentedTabs } from "@/components/admin/ui";
import { t } from "@/i18n";
import { ubDateKey } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { listHolidays } from "@/server/modules/payroll/holidays";

export const metadata = { title: "Амралтын өдрүүд" };
export const instant = false;

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function HolidaysPage({ searchParams }: { searchParams: SP }) {
  await requirePagePermission("holiday:write");
  const sp = await searchParams;
  const thisYear = Number(ubDateKey().slice(0, 4));
  const year = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : thisYear;
  const holidays = await listHolidays({ from: `${year}-01-01`, to: `${year}-12-31` });
  const H = t.admin.payroll.hol;
  return (
    <>
      <PageHeader eyebrow={t.admin.nav.groups.settings} title={H.title} description={H.description} />
      <SegmentedTabs
        className="mb-6"
        label={H.year}
        value={String(year)}
        items={[thisYear - 1, thisYear, thisYear + 1].map((y) => ({ value: String(y), label: String(y), href: `/admin/holidays?year=${y}` }))}
      />
      <HolidayEditor holidays={holidays} />
      <p className="mt-4 text-[13px] text-ink-soft">
        <Link href="/admin/attendance" className="underline underline-offset-4">{t.admin.payroll.att.title}</Link>
      </p>
    </>
  );
}
