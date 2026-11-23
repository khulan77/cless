"use client";

import { useRouter } from "next/navigation";
import { SegmentedTabs } from "@/components/admin/ui";
import { t } from "@/i18n";

const R = t.admin.report;
type Preset = "today" | "week" | "month" | "lastMonth";

/** Preset pills + from/to dates; everything lives in the URL (?from=&to=) */
export function RangePicker({ from, to, preset, presets }: { from: string; to: string; preset: Preset | null; presets: Record<Preset, { from: string; to: string }> }) {
  const router = useRouter();
  const go = (f: string, tt: string) => router.push(`/admin?from=${f}&to=${tt}`);
  const dateCls =
    "h-11 rounded-xl border border-hairline bg-white px-3 text-[15px] tabular-nums text-ink hover:border-ink/20 focus:border-navy focus:outline-none focus:ring-2 focus:ring-champagne/30";
  return (
    <div className="flex flex-wrap items-end gap-3">
      <SegmentedTabs
        label={R.title}
        value={preset ?? "custom"}
        items={(Object.keys(presets) as Preset[]).map((p) => ({ value: p, label: R.presets[p], href: `/admin?from=${presets[p].from}&to=${presets[p].to}` }))}
      />
      <label className="text-[13px] text-ink-soft">
        <span className="mb-1 block">{R.from}</span>
        <input type="date" value={from} max={to} onChange={(e) => e.target.value && go(e.target.value, to)} className={dateCls} />
      </label>
      <label className="text-[13px] text-ink-soft">
        <span className="mb-1 block">{R.to}</span>
        <input type="date" value={to} min={from} onChange={(e) => e.target.value && go(from, e.target.value)} className={dateCls} />
      </label>
    </div>
  );
}
