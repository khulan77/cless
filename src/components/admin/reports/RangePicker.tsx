"use client";

import { useRouter } from "next/navigation";
import { SegmentedTabs } from "@/components/admin/ui";
import { t } from "@/i18n";

const R = t.admin.report;
type Preset = "today" | "week" | "month" | "lastMonth";

/** Preset pills + from/to dates; everything lives in the URL (?from=&to=). `base` + `keep` for report sub-pages and their filters */
export function RangePicker({
  from,
  to,
  preset,
  presets,
  base = "/admin",
  keep = {},
}: {
  from: string;
  to: string;
  preset: Preset | null;
  presets: Record<Preset, { from: string; to: string }>;
  base?: string;
  keep?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const href = (f: string, tt: string) => {
    const sp = new URLSearchParams({ from: f, to: tt });
    for (const [k, v] of Object.entries(keep)) if (v) sp.set(k, v);
    return `${base}?${sp.toString()}`;
  };
  const go = (f: string, tt: string) => router.push(href(f, tt));
  const dateCls =
    "h-11 rounded-xl border border-hairline bg-white px-3 text-[15px] tabular-nums text-ink hover:border-ink/20 focus:border-navy focus:outline-none focus:ring-2 focus:ring-champagne/30";
  return (
    <div className="flex flex-wrap items-end gap-3">
      <SegmentedTabs
        label={R.title}
        value={preset ?? "custom"}
        items={(Object.keys(presets) as Preset[]).map((p) => ({ value: p, label: R.presets[p], href: href(presets[p].from, presets[p].to) }))}
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
