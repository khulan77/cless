import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/sales/SaleActions";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";
import { UserError } from "@/server/errors";
import { shiftReport } from "@/server/modules/cash-shifts/service";

export const metadata = { title: "Ээлжийн тайлан" };
export const instant = false;

const dt = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Asia/Ulaanbaatar", dateStyle: "short", timeStyle: "short" });
const MOVE: Record<string, string> = { SALE: "Бэлэн борлуулалт", REFUND: "Бэлэн буцаалт", PAY_IN: "Мөнгө нэмсэн", PAY_OUT: "Мөнгө гаргасан" };

export default async function ShiftReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("shift:own");
  const { id } = await params;
  const r = await shiftReport(id).catch((e) => {
    if (e instanceof UserError) return null;
    throw e;
  });
  if (!r) notFound();
  const sh = r.shift;
  const row = (k: string, v: string, strong = false) => (
    <div key={k} className={`flex justify-between py-1 ${strong ? "font-medium" : ""}`}>
      <dt>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );

  return (
    <div className="shift-report mx-auto max-w-xl rounded-lg border border-line bg-white p-6 text-[14px] print:border-0 print:p-0">
      <style>{`@media print { body * { visibility: hidden; } .shift-report, .shift-report * { visibility: visible; } .shift-report { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-medium">Кассын ээлжийн тайлан</h1>
          <p className="text-navy/60">
            {sh.openedBy.name} · {dt(sh.openedAt)} — {sh.closedAt ? `${dt(sh.closedAt)} · ${sh.closedBy?.name ?? ""}` : "нээлттэй"}
          </p>
        </div>
        <PrintButton />
      </div>
      <dl className="divide-y divide-line border-y border-line">
        {row("Эхний бэлэн мөнгө", formatMNT(sh.openingCash))}
        {row("Борлуулалтын тоо", String(r.salesCount))}
        {row("Борлуулалтын дүн", formatMNT(r.salesTotal))}
        {row("Хөнгөлөлт", formatMNT(r.discountTotal))}
        {r.byMethod.map((m) => row(`${t.admin.payMethod[m.method]} (${m.count})`, formatMNT(m.amount)))}
        {row(`Буцаалт (${r.refundsCount})`, `−${formatMNT(r.refundsTotal)}`)}
        {row("Кассанд байх ёстой", formatMNT(r.expectedCash), true)}
        {sh.countedCash !== null && row("Тоолсон", formatMNT(sh.countedCash), true)}
        {sh.difference !== null && row("Зөрүү", formatMNT(sh.difference), true)}
      </dl>
      {sh.note && <p className="mt-3 text-navy/70">Тайлбар: {sh.note}</p>}
      {sh.movements.length > 0 && (
        <>
          <h2 className="mb-2 mt-5 text-[13px] font-medium uppercase tracking-[0.4px] text-navy/55">Бэлэн мөнгөний хөдөлгөөн</h2>
          <ul className="divide-y divide-line text-[13px]">
            {sh.movements.map((m) => (
              <li key={m.id} className="flex justify-between py-1.5">
                <span>
                  {dt(m.createdAt)} · {MOVE[m.type]}
                  {m.note ? ` · ${m.note}` : ""}
                </span>
                <span className="tabular-nums">{formatMNT(m.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
