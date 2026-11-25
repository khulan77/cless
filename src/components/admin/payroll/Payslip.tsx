/**
 * Цалингийн хуудас (A4) — хэвлэх / "PDF болгож хадгалах". Үйлчлүүлэгчийн мэдээлэлгүй.
 * Хөтчийн хэвлэх цонхоор PDF үүсгэнэ (Кирилл фонт найдвартай, нэмэлт сангүй).
 */
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import type { LineDetails } from "@/server/modules/payroll/periods";

const P = t.admin.payroll;
const C = P.col;

export type PayslipData = {
  salon: string;
  staff: string;
  role: string;
  from: string;
  to: string;
  kind: string;
  status: string;
  workedDays: number;
  plannedDays: number;
  baseSalary: number;
  serviceCommission: number;
  productCommission: number;
  adjustments: number;
  deductions: number;
  gross: number;
  siEmployee: number;
  pit: number;
  advancePaid: number;
  net: number;
  details: LineDetails;
};

export function Payslip({ d }: { d: PayslipData }) {
  const isFinal = d.kind === "FINAL";
  const earnings: [string, number][] = [
    [`${C.base} (${d.workedDays} / ${d.plannedDays})`, d.baseSalary],
    [C.service, d.serviceCommission],
    [C.product, d.productCommission],
    ...d.details.adjustments.filter((a) => a.type === "ADDITION" && a.period === "this").map((a) => [a.reason, a.amount] as [string, number]),
  ];
  const deductions: [string, number][] = [
    [C.si, d.siEmployee],
    [C.pit, d.pit],
    ...d.details.adjustments.filter((a) => a.type === "DEDUCTION" && a.period === "this").map((a) => [a.reason, a.amount] as [string, number]),
  ];
  return (
    <article className="payslip mx-auto max-w-[780px] rounded-2xl border border-hairline bg-white p-8 text-[14px] text-ink print:max-w-none print:rounded-none print:border-0 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 14mm; } body * { visibility: hidden; } .payslip, .payslip * { visibility: visible; } .payslip { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <p className="text-[13px] uppercase tracking-[0.12em] text-ink-soft">{d.salon}</p>
          <h1 className="font-display text-[26px] font-semibold">{P.slip.title}</h1>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right text-[13px]">
          <dt className="text-ink-soft">{P.slip.employee}</dt>
          <dd className="font-medium">{d.staff} · {d.role}</dd>
          <dt className="text-ink-soft">{P.slip.period}</dt>
          <dd className="tabular-nums">{d.from} — {d.to}</dd>
          <dt className="text-ink-soft">{P.periods.kind}</dt>
          <dd>{P.kind[d.kind]} · {P.status[d.status]}</dd>
        </dl>
      </header>

      <div className="mt-5 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <Block title={P.slip.earnings} rows={earnings} total={[C.gross, d.gross]} />
        <Block title={P.slip.deductions} rows={deductions} total={[P.slip.deductions, d.siEmployee + d.pit + d.deductions]} />
      </div>

      {isFinal && d.details.month && (
        <div className="mt-5 rounded-xl bg-canvas p-4 text-[13px] print:bg-transparent print:p-0">
          <p className="mb-1 font-medium">{P.detail.month}</p>
          <p className="tabular-nums">
            {C.gross} {formatMNT(d.details.month.gross)} − {C.si} {formatMNT(d.details.month.siEmployee)} − {C.pit} {formatMNT(d.details.month.pit)} = {P.detail.monthNet}{" "}
            {formatMNT(d.details.month.net)}; − {P.detail.advanceNet} {formatMNT(d.advancePaid)}
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t-2 border-navy pt-4">
        <span className="text-[16px] font-semibold">{P.slip.total}</span>
        <span className="text-[24px] font-semibold tabular-nums">{formatMNT(d.net)}</span>
      </div>
      <p className="mt-6 text-[12px] text-ink-faint">{P.slip.generated(formatDateTime(new Date()))}</p>
    </article>
  );
}

function Block({ title, rows, total }: { title: string; rows: [string, number][]; total: [string, number] }) {
  return (
    <section>
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{title}</h2>
      <table className="w-full">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i} className="border-b border-hairline">
              <td className="py-1.5 pr-3">{k}</td>
              <td className="py-1.5 text-right tabular-nums">{formatMNT(v)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2 pr-3">{total[0]}</td>
            <td className="py-2 text-right tabular-nums">{formatMNT(total[1])}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

type SlipLine = Omit<PayslipData, "salon" | "staff" | "role" | "kind" | "status"> & {
  staff: { name: string; role: string };
  period: { kind: string; status: string };
};

export function toPayslipData(l: SlipLine, salon: string): PayslipData {
  return {
    salon,
    staff: l.staff.name,
    role: t.admin.nav.roles[l.staff.role] ?? l.staff.role,
    from: l.from,
    to: l.to,
    kind: l.period.kind,
    status: l.period.status,
    workedDays: l.workedDays,
    plannedDays: l.plannedDays,
    baseSalary: l.baseSalary,
    serviceCommission: l.serviceCommission,
    productCommission: l.productCommission,
    adjustments: l.adjustments,
    deductions: l.deductions,
    gross: l.gross,
    siEmployee: l.siEmployee,
    pit: l.pit,
    advancePaid: l.advancePaid,
    net: l.net,
    details: l.details,
  };
}
