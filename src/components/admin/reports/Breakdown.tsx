"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { SegmentedTabs } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import type { BreakdownRow, StaffRow } from "@/server/modules/reports/queries";

const R = t.admin.report;
type Tab = "service" | "staff" | "product" | "channel";
const TOP = 8;

/** Top 8 + "Бусад"; bold name, grey count, amount on the right, a relative bar below */
type ChannelRow = { channel: "POS" | "ONLINE"; amount: number; service: number; product: number; sales: number };

export function Breakdown({ byService, byStaff, byProduct, byChannel = [] }: { byService: BreakdownRow[]; byStaff: StaffRow[]; byProduct: BreakdownRow[]; byChannel?: ChannelRow[] }) {
  const [tab, setTab] = useState<Tab>("service");
  const [open, setOpen] = useState<string | null>(null);
  const rows: { key: string; name: string; count?: string; amount: number; sub?: string; staff?: StaffRow }[] =
    tab === "service"
      ? byService.map((r) => ({ key: r.key, name: r.name, count: R.times(r.qty), amount: r.amount }))
      : tab === "channel"
        ? byChannel.map((c) => ({ key: c.channel, name: c.channel === "POS" ? "Касс (POS)" : "Онлайн (сайт)", count: `${c.sales} борлуулалт`, amount: c.amount, sub: R.staffSplit(formatMNT(c.service), formatMNT(c.product)) }))
      : tab === "product"
        ? byProduct.map((r) => ({ key: r.key, name: r.name, count: R.pieces(r.qty), amount: r.amount, sub: r.margin != null ? R.margin(r.margin) : undefined }))
        : byStaff.map((s) => ({ key: s.key, name: s.name ?? R.unknownStaff, amount: s.amount, sub: R.staffSplit(formatMNT(s.service), formatMNT(s.product)), staff: s }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const shown = rows.slice(0, TOP);
  const rest = rows.slice(TOP);
  if (rest.length) shown.push({ key: "__other", name: R.other, count: R.times(rest.length), amount: rest.reduce((s, r) => s + r.amount, 0) });
  const max = Math.max(1, ...shown.map((r) => r.amount));

  return (
    <section className="rounded-2xl border border-hairline bg-white p-6">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[22px] font-semibold">{R.breakdown}</h2>
        <SegmentedTabs
          label={R.breakdown}
          value={tab}
          onChange={(v) => (setTab(v), setOpen(null))}
          items={[
            { value: "service", label: R.byService },
            { value: "staff", label: R.byStaff },
            { value: "product", label: R.byProduct },
            ...(byChannel.length ? [{ value: "channel" as const, label: "Сувгаар" }] : []),
          ]}
        />
        <span className="ml-auto text-[13px] text-ink-soft tabular-nums">{R.rows(rows.length, formatMNT(total))}</span>
      </header>
      {shown.length === 0 ? (
        <p className="py-6 text-[15px] text-ink-soft">{R.noRows}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {shown.map((r) => {
            const expandable = Boolean(r.staff && r.staff.services.length);
            const isOpen = open === r.key;
            const head = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="flex min-w-0 items-baseline gap-2 text-[15px]">
                    <span className="truncate font-semibold text-ink" title={r.name}>
                      {r.name}
                    </span>
                    {r.count && <span className="shrink-0 text-[13px] text-ink-soft">{r.count}</span>}
                  </p>
                  <span className="flex shrink-0 items-center gap-1 text-[15px] font-semibold tabular-nums">
                    {formatMNT(r.amount)}
                    {expandable && <ChevronDown className={`size-4 text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />}
                  </span>
                </div>
                {r.sub && <p className="mt-0.5 text-[13px] text-ink-soft tabular-nums">{r.sub}</p>}
                <div className="mt-2 h-1.5 rounded-full bg-ink/[0.06]">
                  <div className="h-full rounded-full bg-navy" style={{ width: `${Math.max(1, (r.amount / max) * 100)}%` }} />
                </div>
              </>
            );
            return (
              <li key={r.key} className="py-3.5">
                {expandable ? (
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.key)} className="block w-full text-left">
                    {head}
                  </button>
                ) : (
                  head
                )}
                {isOpen && r.staff && (
                  <ul className="mt-3 space-y-1.5 border-l border-hairline pl-4">
                    {r.staff.services.map((s) => (
                      <li key={s.key} className="flex justify-between gap-3 text-[14px]">
                        <span className="min-w-0 truncate">
                          {s.name} <span className="text-ink-soft">{R.times(s.qty)}</span>
                        </span>
                        <span className="tabular-nums">{formatMNT(s.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
