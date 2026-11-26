import Link from "next/link";
import { btnClass, inputClass } from "@/components/admin/ui";
import type { FinancePeriod } from "@/server/modules/finance/reports";
import type { ReportRange } from "@/server/modules/reports/definitions";

const LABELS: Record<FinancePeriod, string> = { day: "Өдөр", half: "15 хоног", month: "Сар", custom: "Дурын" };

/** Өдөр / 15 хоног (1–15, 16–эцэс) / сар / дурын — GET форм (сервер хуудас) */
export function PeriodPicker({ base, period, range, extra = {} }: { base: string; period: FinancePeriod; range: ReportRange; extra?: Record<string, string | null | undefined> }) {
  const keep = Object.entries(extra).filter((e): e is [string, string] => !!e[1]);
  const href = (p: FinancePeriod) => `${base}?${new URLSearchParams([["period", p], ["date", range.to], ...keep]).toString()}`;
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div role="tablist" aria-label="Хугацаа" className="inline-flex rounded-xl border border-hairline bg-white p-1">
        {(["day", "half", "month", "custom"] as const).map((p) => (
          <Link key={p} href={href(p)} role="tab" aria-selected={period === p} className={`rounded-lg px-3 py-1.5 text-[14px] ${period === p ? "bg-navy text-white" : "text-ink-soft hover:text-navy"}`}>
            {LABELS[p]}
          </Link>
        ))}
      </div>
      <form method="get" action={base} className="flex flex-wrap items-end gap-2">
        {keep.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input type="hidden" name="period" value={period} />
        {period === "custom" ? (
          <>
            <label className="text-[13px] text-ink-soft">
              Эхлэх
              <input type="date" name="from" defaultValue={range.from} className={`${inputClass} mt-1 block w-40`} />
            </label>
            <label className="text-[13px] text-ink-soft">
              Дуусах
              <input type="date" name="to" defaultValue={range.to} className={`${inputClass} mt-1 block w-40`} />
            </label>
          </>
        ) : (
          <label className="text-[13px] text-ink-soft">
            Огноо
            <input type="date" name="date" defaultValue={range.to} className={`${inputClass} mt-1 block w-40`} />
          </label>
        )}
        <button type="submit" className={btnClass("secondary")}>Харах</button>
      </form>
      <p className="w-full text-[13px] text-ink-soft tabular-nums">{range.from === range.to ? range.from : `${range.from} — ${range.to}`}</p>
    </div>
  );
}
