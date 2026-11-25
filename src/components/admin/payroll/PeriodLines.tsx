"use client";

import { ChevronDown, FileText } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { Badge } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import type { LineDetails } from "@/server/modules/payroll/periods";
import { STATUS_TONE } from "./AttendanceGrid";

const C = t.admin.payroll.col;
const D = t.admin.payroll.detail;
const A = t.admin.payroll.att;

export type LineView = {
  id: string;
  staffId: string;
  name: string;
  plannedDays: number;
  workedDays: number;
  baseSalary: number;
  serviceCommission: number;
  productCommission: number;
  adjustments: number;
  deductions: number;
  gross: number;
  siEmployee: number;
  pit: number;
  siEmployer: number;
  advancePaid: number;
  net: number;
  details: LineDetails;
};

const pct = (bp: number) => `${(bp / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const num = "px-3 py-2.5 text-right tabular-nums";

export function PeriodLines({ lines, isFinal, slipBase }: { lines: LineView[]; isFinal: boolean; slipBase?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const total = (k: keyof LineView) => lines.reduce((s, l) => s + (l[k] as number), 0);
  const cols = isFinal ? 12 : 11;

  return (
    <div className="overflow-x-auto rounded-2xl border border-hairline bg-white">
      <table className="w-full min-w-[1100px] text-[14px]">
        <thead className="text-[13px] text-ink-soft">
          <tr className="border-b border-hairline">
            <th className="px-4 py-3 text-left font-medium">{C.staff}</th>
            <th className="px-3 py-3 text-right font-medium">{C.days}</th>
            <th className="px-3 py-3 text-right font-medium">{C.base}</th>
            <th className="px-3 py-3 text-right font-medium">{C.service}</th>
            <th className="px-3 py-3 text-right font-medium">{C.product}</th>
            <th className="px-3 py-3 text-right font-medium">{C.adjust}</th>
            <th className="px-3 py-3 text-right font-medium">{C.gross}</th>
            <th className="px-3 py-3 text-right font-medium">{C.si}</th>
            <th className="px-3 py-3 text-right font-medium">{C.pit}</th>
            {isFinal && <th className="px-3 py-3 text-right font-medium">{C.advance}</th>}
            <th className="px-3 py-3 text-right font-medium">{C.net}</th>
            <th className="px-3 py-3 text-right font-medium">{C.er}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const isOpen = open === l.id;
            return (
              <Fragment key={l.id}>
                <tr className="border-b border-hairline hover:bg-canvas">
                  <td className="px-4 py-2.5">
                    <button type="button" onClick={() => setOpen(isOpen ? null : l.id)} aria-expanded={isOpen} className="flex items-center gap-2 text-left font-medium hover:underline">
                      <ChevronDown className={`size-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                      {l.name}
                    </button>
                    {l.details.warnings.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1 pl-6">
                        {l.details.warnings.map((w) => <Badge key={w} tone="red">{t.admin.payroll.warnings[w] ?? w}</Badge>)}
                      </div>
                    )}
                  </td>
                  <td className={num}>{l.workedDays} / {l.plannedDays}</td>
                  <td className={num}>{formatMNT(l.baseSalary)}</td>
                  <td className={num}>{formatMNT(l.serviceCommission)}</td>
                  <td className={num}>{formatMNT(l.productCommission)}</td>
                  <td className={num}>{l.adjustments || l.deductions ? `+${formatMNT(l.adjustments)} / −${formatMNT(l.deductions)}` : "—"}</td>
                  <td className={`${num} font-medium`}>{formatMNT(l.gross)}</td>
                  <td className={num}>{formatMNT(l.siEmployee)}</td>
                  <td className={num}>{formatMNT(l.pit)}</td>
                  {isFinal && <td className={num}>{formatMNT(l.advancePaid)}</td>}
                  <td className={`${num} font-semibold ${l.net < 0 ? "text-err" : ""}`}>{formatMNT(l.net)}</td>
                  <td className={`${num} text-ink-soft`}>{formatMNT(l.siEmployer)}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-hairline bg-canvas/60">
                    <td colSpan={cols} className="px-4 py-4">
                      <Breakdown l={l} slipHref={slipBase ? `${slipBase}${l.staffId}` : undefined} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot className="font-semibold">
          <tr>
            <td className="px-4 py-3">{t.admin.payroll.period.totals}</td>
            <td />
            <td className={num}>{formatMNT(total("baseSalary"))}</td>
            <td className={num}>{formatMNT(total("serviceCommission"))}</td>
            <td className={num}>{formatMNT(total("productCommission"))}</td>
            <td className={num}>+{formatMNT(total("adjustments"))} / −{formatMNT(total("deductions"))}</td>
            <td className={num}>{formatMNT(total("gross"))}</td>
            <td className={num}>{formatMNT(total("siEmployee"))}</td>
            <td className={num}>{formatMNT(total("pit"))}</td>
            {isFinal && <td className={num}>{formatMNT(total("advancePaid"))}</td>}
            <td className={num}>{formatMNT(total("net"))}</td>
            <td className={num}>{formatMNT(total("siEmployer"))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function Breakdown({ l, slipHref }: { l: LineView; slipHref?: string }) {
  const d = l.details;
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <section>
        <h4 className="mb-2 text-[14px] font-semibold">{D.attendance}</h4>
        <div className="flex flex-wrap gap-1">
          {d.attendance.map((a) => (
            <span
              key={a.date}
              title={`${a.date} · ${A.status[a.status]} · ${formatMNT(a.amount)}`}
              className={`grid h-9 w-10 place-items-center rounded-md text-[12px] tabular-nums ${STATUS_TONE[a.status]} ${a.marked ? "ring-2 ring-navy/40" : ""}`}
            >
              {Number(a.date.slice(8))}
            </span>
          ))}
        </div>

        <h4 className="mb-2 mt-5 text-[14px] font-semibold">{D.commissions}</h4>
        {d.commissions.length === 0 ? (
          <p className="text-[13px] text-ink-soft">{D.noCommissions}</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-hairline bg-white">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-white text-ink-soft">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{D.date}</th>
                  <th className="px-3 py-2 text-left font-medium">{D.item}</th>
                  <th className="px-3 py-2 text-left font-medium">{D.receipt}</th>
                  <th className="px-3 py-2 text-right font-medium">{D.amount}</th>
                  <th className="px-3 py-2 text-right font-medium">{D.rule}</th>
                  <th className="px-3 py-2 text-right font-medium">{D.commission}</th>
                </tr>
              </thead>
              <tbody>
                {d.commissions.map((c, i) => (
                  <tr key={i} className="border-t border-hairline">
                    <td className="px-3 py-1.5 tabular-nums">{c.day}</td>
                    <td className="px-3 py-1.5">{c.name}{c.qty > 1 ? ` ×${c.qty}` : ""}</td>
                    <td className="px-3 py-1.5 font-mono">{c.receipt ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatMNT(c.amount)}</td>
                    <td className="px-3 py-1.5 text-right">{c.rule ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatMNT(c.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h4 className="mb-2 mt-5 text-[14px] font-semibold">{D.adjustments}</h4>
        {d.adjustments.length === 0 ? (
          <p className="text-[13px] text-ink-soft">{D.noAdjustments}</p>
        ) : (
          <ul className="space-y-1 text-[13px]">
            {d.adjustments.map((a, i) => (
              <li key={i} className="flex gap-3">
                <span className={`w-28 text-right tabular-nums ${a.type === "DEDUCTION" ? "text-err" : "text-ok"}`}>{a.type === "DEDUCTION" ? "−" : "+"}{formatMNT(a.amount)}</span>
                <span>{a.reason}{a.period === "advance" && <span className="text-ink-soft"> ({D.fromAdvance})</span>}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        {d.month && (
          <div>
            <h4 className="mb-2 text-[14px] font-semibold">{D.month}</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              <Dt k={C.base} v={d.month.base} />
              <Dt k={C.service} v={d.month.serviceCommission} />
              <Dt k={C.product} v={d.month.productCommission} />
              <Dt k={C.gross} v={d.month.gross} strong />
              <Dt k={C.si} v={d.month.siEmployee} />
              <Dt k={C.pit} v={d.month.pit} />
              <Dt k={D.monthNet} v={d.month.net} strong />
              <Dt k={D.advanceNet} v={-d.month.advanceNet} />
              <Dt k={C.net} v={l.net} strong />
            </dl>
          </div>
        )}
        {d.tax && (
          <div>
            <h4 className="mb-2 text-[14px] font-semibold">{D.tax}</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              <Dt k={D.siBase} v={d.tax.siBase} />
              <Dt k={D.taxable} v={d.tax.taxable} />
              <Dt k={D.pitBefore} v={d.tax.pitBefore} />
              <Dt k={D.credit} v={-d.tax.credit} />
            </dl>
          </div>
        )}
        <div>
          <h4 className="mb-2 text-[14px] font-semibold">{D.rates}</h4>
          {d.rates ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              <dt className="text-ink-soft">{t.admin.payroll.rates.effectiveFrom}</dt>
              <dd className="tabular-nums">{d.rates.effectiveFrom} {!d.rates.confirmed && <Badge tone="red">{t.admin.payroll.rates.notConfirmed}</Badge>}</dd>
              <dt className="text-ink-soft">{C.si} ({D.employee})</dt>
              <dd className="tabular-nums">{pct(d.rates.employeeBp)}</dd>
              <dt className="text-ink-soft">{C.si} ({D.employer}{d.rates.category ? ` · ${d.rates.category}` : ""})</dt>
              <dd className="tabular-nums">{pct(d.rates.employerBp)}</dd>
              <dt className="text-ink-soft">{D.cap}</dt>
              <dd className="tabular-nums">{d.rates.siCap === null ? D.noLimit : formatMNT(d.rates.siCap)}</dd>
              <dt className="text-ink-soft">{C.pit}</dt>
              <dd className="tabular-nums">{pct(d.rates.pitBp)}</dd>
            </dl>
          ) : (
            <p className="text-[13px] text-ink-soft">{D.none}</p>
          )}
        </div>
        {slipHref && (
          <Link href={slipHref} className="inline-flex min-h-11 items-center gap-2 text-[14px] font-medium underline underline-offset-4">
            <FileText className="size-4" /> {t.admin.payroll.period.payslips}
          </Link>
        )}
      </section>
    </div>
  );
}

function Dt({ k, v, strong }: { k: string; v: number; strong?: boolean }) {
  return (
    <>
      <dt className="text-ink-soft">{k}</dt>
      <dd className={`text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{formatMNT(v)}</dd>
    </>
  );
}
