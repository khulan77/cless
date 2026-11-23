"use client";

import { useEffect, useRef, useState } from "react";
import { SegmentedTabs } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { compactMNT, shortDay } from "./format";

const R = t.admin.report;
type Day = { day: string; service: number; product: number };

const H = 300;
const PAD = { l: 64, r: 12, t: 12, b: 28 };
const SERVICE = "#0E2243";
const PRODUCT = "#B89B72";

/** Stacked bars per day (service + product), dashed average, hover value; "Хүснэгт" switches to a table */
export function DailyChart({ days }: { days: Day[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real pixel width so axis text stays 12px (no SVG scaling)
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);
  const totals = days.map((d) => d.service + d.product);
  const max = Math.max(1, ...totals);
  const avg = totals.reduce((s, x) => s + x, 0) / Math.max(1, days.length);
  // Nice top value for the axis
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const bw = iw / days.length;
  const y = (v: number) => PAD.t + ih - (v / top) * ih;
  const labelEvery = Math.max(1, Math.ceil((days.length * 34) / (W - 76)));
  const h = hover !== null ? days[hover] : null;

  return (
    <section className="rounded-2xl border border-hairline bg-white p-6">
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-display text-[22px] font-semibold">{R.daily}</h2>
        <span className="text-[14px] text-ink-soft">{R.dayCount(days.length)}</span>
        <span className="flex items-center gap-4 text-[13px] text-ink-soft">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERVICE }} />{R.legendService}</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: PRODUCT }} />{R.legendProduct}</span>
          <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-ink-soft" />{R.averageLine(formatMNT(Math.round(avg)))}</span>
        </span>
        <SegmentedTabs
          className="ml-auto"
          label={R.daily}
          value={view}
          onChange={setView}
          items={[
            { value: "chart", label: R.chart },
            { value: "table", label: R.table },
          ]}
        />
      </header>

      {view === "chart" ? (
        <div ref={box} className="relative">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={R.daily} onMouseLeave={() => setHover(null)}>
            {[0, 1, 2, 3, 4].map((i) => {
              const v = (top / 4) * i;
              return (
                <g key={i}>
                  <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#ECEAE6" />
                  <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#6B6F78">
                    {compactMNT(v)}
                  </text>
                </g>
              );
            })}
            {days.map((d, i) => {
              const x = PAD.l + i * bw + bw * 0.18;
              const w = Math.max(2, bw * 0.64);
              const sTop = y(d.service);
              const pTop = y(d.service + d.product);
              return (
                <g key={d.day} onMouseEnter={() => setHover(i)}>
                  <rect x={PAD.l + i * bw} y={PAD.t} width={bw} height={ih} fill={hover === i ? "rgba(184,155,114,0.08)" : "transparent"} />
                  {d.service > 0 && <rect x={x} y={sTop} width={w} height={y(0) - sTop} fill={SERVICE} rx={2} />}
                  {d.product > 0 && <rect x={x} y={pTop} width={w} height={sTop - pTop} fill={PRODUCT} rx={2} />}
                  {i % labelEvery === 0 && (
                    <text x={PAD.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="#6B6F78">
                      {days.length > 31 ? shortDay(d.day) : Number(d.day.slice(8))}
                    </text>
                  )}
                </g>
              );
            })}
            {avg > 0 && <line x1={PAD.l} x2={W - PAD.r} y1={y(avg)} y2={y(avg)} stroke="#6B6F78" strokeDasharray="5 5" />}
          </svg>
          {h && (
            <div
              role="status"
              className="pointer-events-none absolute top-2 rounded-xl border border-hairline bg-white px-3 py-2 text-[13px] shadow-[0_8px_24px_rgba(14,34,67,0.12)]"
              style={{ left: `clamp(0px, calc(${((PAD.l + (hover! + 0.5) * bw) / W) * 100}% - 90px), calc(100% - 180px))` }}
            >
              <p className="font-medium tabular-nums">{h.day}</p>
              <p className="tabular-nums text-ink-soft">{R.legendService}: {formatMNT(h.service)}</p>
              <p className="tabular-nums text-ink-soft">{R.legendProduct}: {formatMNT(h.product)}</p>
              <p className="font-medium tabular-nums">{R.sum}: {formatMNT(h.service + h.product)}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-[340px] overflow-auto">
          <table className="w-full text-[14px] tabular-nums">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-[13px] text-ink-soft">
                <th className="py-2 font-medium">{R.day}</th>
                <th className="py-2 text-right font-medium">{R.legendService}</th>
                <th className="py-2 text-right font-medium">{R.legendProduct}</th>
                <th className="py-2 text-right font-medium">{R.sum}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-t border-hairline">
                  <td className="py-2">{d.day}</td>
                  <td className="py-2 text-right">{formatMNT(d.service)}</td>
                  <td className="py-2 text-right">{formatMNT(d.product)}</td>
                  <td className="py-2 text-right font-medium">{formatMNT(d.service + d.product)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
