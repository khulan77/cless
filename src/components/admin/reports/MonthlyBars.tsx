import { compactMNT } from "./format";

type Month = { month: string; soldQty: number; revenue: number; usedQty: number };

/** Сараар орлогын багана (серверээр зурсан SVG) + доор нь зарсан / зарцуулсан тоо */
export function MonthlyBars({ months, label }: { months: Month[]; label: string }) {
  const max = Math.max(1, ...months.map((m) => m.revenue));
  const W = 960;
  const H = 180;
  const TOP = 20;
  const bw = W / Math.max(1, months.length);
  return (
    <figure>
      <svg viewBox={`0 ${-TOP} ${W} ${H + 40 + TOP}`} role="img" aria-label={label} className="h-auto w-full">
        {months.map((m, i) => {
          const h = Math.round((Math.max(0, m.revenue) / max) * H);
          const x = i * bw + bw * 0.18;
          return (
            <g key={m.month}>
              <title>{`${m.month}: ${m.revenue.toLocaleString("mn-MN")}₮ · ${m.soldQty} / ${m.usedQty}`}</title>
              <rect x={x} y={H - h} width={bw * 0.64} height={Math.max(h, m.revenue > 0 ? 2 : 0)} rx={4} className="fill-navy" />
              {m.revenue > 0 && (
                <text x={x + bw * 0.32} y={H - h - 6} textAnchor="middle" className="fill-ink-soft text-[11px] tabular-nums">
                  {compactMNT(m.revenue)}
                </text>
              )}
              <text x={x + bw * 0.32} y={H + 18} textAnchor="middle" className="fill-ink-soft text-[11px] tabular-nums">
                {m.month.slice(2).replace("-", "/")}
              </text>
              <text x={x + bw * 0.32} y={H + 34} textAnchor="middle" className="fill-ink-faint text-[10px] tabular-nums">
                {m.soldQty}·{m.usedQty}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={W} y1={H} y2={H} className="stroke-hairline" />
      </svg>
    </figure>
  );
}
