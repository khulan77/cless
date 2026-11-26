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
const S = t.admin.payroll.colShort;
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

const adjText = (add: number, ded: number) =>
  !add && !ded ? "—" : [add ? `+${formatMNT(add)}` : "", ded ? `−${formatMNT(ded)}` : ""].filter(Boolean).join(" / ");
const pct = (bp: number) => `${(bp / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const num = "whitespace-nowrap px-2 py-2.5 text-right tabular-nums";

export function PeriodLines({ lines, isFinal, slipBase }: { lines: LineView[]; isFinal: boolean; slipBase?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const total = (k: keyof LineView) => lines.reduce((s, l) => s + (l[k] as number), 0);
  const cols = isFinal ? 11 : 10;

  return (
    <div className="@container overflow-x-auto rounded-2xl border border-hairline bg-white">
      <table className="w-full min-w-[900px] text-[13px]">
        <thead className="text-[12px] text-ink-soft">
          <tr className="border-b border-hairline">
            <th className="px-4 py-3 text-left font-medium">{C.staff}</th>
            {(
              [
                [S.base, C.base],
                [S.service, C.service],
                [S.product, C.product],
                [S.adjust, C.adjust],
                [S.gross, C.gross],
                [S.si, C.si],
                [S.pit, C.pit],
                ...(isFinal ? [[S.advance, C.advance]] : []),
                [S.net, C.net],
                [S.er, C.er],
              ] as [string, string][]
            ).map(([short, full]) => (
              <th key={full} scope="col" title={full} className="px-2 py-3 text-right font-medium">
                <abbr title={full} className="no-underline">{short}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const isOpen = open === l.id;
            return (
              <Fragment key={l.id}>
                <tr className="border-b border-hairline hover:bg-canvas">
                  <td className="px-4 py-2.5">
                    <button type="button" onClick={() => setOpen(isOpen ? null : l.id)} aria-expanded={isOpen} className="flex items-center gap-2 whitespace-nowrap text-left font-medium hover:underline">
                      <ChevronDown className={`size-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                      {l.name}
                    </button>
                    <span className="block whitespace-nowrap pl-6 text-[12px] text-ink-soft tabular-nums">{C.days}: {l.workedDays} / {l.plannedDays}</span>
                    {l.details.hours && (
                      <span className="block whitespace-nowrap pl-6 text-[12px] text-ink-soft tabular-nums">
                        Цаг: {l.details.hours.worked} / {l.details.hours.norm}
                        {l.details.hours.overtime > 0 && <span className="ml-1 font-medium text-amber-700">· илүү {l.details.hours.overtime}</span>}
                      </span>
                    )}
                    {l.details.warnings.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1 pl-6">
                        {l.details.warnings.map((w) => <Badge key={w} tone="red">{t.admin.payroll.warnings[w] ?? w}</Badge>)}
                      </div>
                    )}
                  </td>
                  <td className={num}>{formatMNT(l.baseSalary)}</td>
                  <td className={num}>{formatMNT(l.serviceCommission)}</td>
                  <td className={num}>{formatMNT(l.productCommission)}</td>
                  <td className={num}>{adjText(l.adjustments, l.deductions)}</td>
                  <td className={`${num} font-medium`}>{formatMNT(l.gross)}</td>
                  <td className={num}>{formatMNT(l.siEmployee)}</td>
                  <td className={num}>{formatMNT(l.pit)}</td>
                  {isFinal && <td className={num}>{formatMNT(l.advancePaid)}</td>}
                  <td className={`${num} font-semibold ${l.net < 0 ? "text-err" : ""}`}>{formatMNT(l.net)}</td>
                  <td className={`${num} text-ink-soft`}>{formatMNT(l.siEmployer)}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-hairline bg-canvas/60">
                    <td colSpan={cols} className="p-0">
                      {/* Хүснэгт хэвтээ гүйлгэгддэг ч задаргаа харагдах өргөнд (100cqw) багтана */}
                      <div className="sticky left-0 w-[100cqw] px-4 py-4">
                        <Breakdown l={l} slipHref={slipBase ? `${slipBase}${l.staffId}` : undefined} />
                      </div>
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
            <td className={num}>{formatMNT(total("baseSalary"))}</td>
            <td className={num}>{formatMNT(total("serviceCommission"))}</td>
            <td className={num}>{formatMNT(total("productCommission"))}</td>
            <td className={num}>{adjText(total("adjustments"), total("deductions"))}</td>
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

        {d.hours && d.hours.weeks.length > 0 && (
          <>
            <h4 className="mb-2 mt-5 text-[14px] font-semibold">Цаг (7 хоногт 40 цаг норм)</h4>
            <div className="flex flex-wrap gap-2 text-[12px] tabular-nums">
              {d.hours.weeks.map((w) => (
                <span key={w.week} className={`rounded-lg px-2.5 py-1.5 ${w.overtime > 0 ? "bg-amber-100 text-amber-900" : "bg-canvas"}`}>
                  {w.week.slice(5)}~ · {w.hours} ц{w.overtime > 0 ? ` (+${w.overtime})` : ""}
                </span>
              ))}
            </div>
            <p className="mt-1 text-[12px] text-ink-soft">Илүү цагийн хөлсийг одоохондоо цалинд оруулаагүй (нягтлан шийдсэний дараа).</p>
          </>
        )}

        {d.bases && (
          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-canvas p-3 text-[13px]">
            <div>
              <dt className="text-ink-soft">Үйлчилгээний суурь ({d.bases.on === "NET" ? "НӨАТ-гүй" : "НӨАТ-тэй"})</dt>
              <dd className="tabular-nums">{formatMNT(d.bases.service)} → <strong>{formatMNT(l.serviceCommission)}</strong></dd>
            </div>
            <div>
              <dt className="text-ink-soft">Бүтээгдэхүүний суурь ({d.bases.on === "NET" ? "НӨАТ-гүй" : "НӨАТ-тэй"})</dt>
              <dd className="tabular-nums">{formatMNT(d.bases.product)} → <strong>{formatMNT(l.productCommission)}</strong></dd>
            </div>
          </dl>
        )}

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
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{c.day}</td>
                    <td className="px-3 py-1.5">{c.name}{c.qty > 1 ? ` ×${c.qty}` : ""}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[12px]">{c.receipt ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums" title={c.base !== undefined && c.base !== c.amount ? `Суурь (НӨАТ-гүй): ${formatMNT(c.base)}` : undefined}>{formatMNT(c.amount)}</td>
                    <td className="px-3 py-1.5 text-right">{c.rule ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{formatMNT(c.commission)}</td>
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
              <Dt k={D.advanceNet} v={-d.month.advanceNet || 0} />
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
              <Dt k={D.credit} v={-d.tax.credit || 0} />
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
