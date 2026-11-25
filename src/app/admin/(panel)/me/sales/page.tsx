import { Receipt } from "lucide-react";
import { MeTabs } from "@/components/admin/me/MeTabs";
import { EmptyState, PageHeader, SegmentedTabs, Table, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";
import { presetRange } from "@/server/modules/reports/definitions";
import { mySales } from "@/server/modules/staff/dashboard";
import { ubDateKey } from "@/lib/time";
import { halfRange } from "@/server/modules/payroll/ranges";
import { getPayrollSettings } from "@/server/modules/payroll/settings";

export const metadata = { title: "Миний борлуулалт" };
export const instant = false;

const M = t.admin.me;
const PERIODS = ["today", "week", "h1", "h2", "month"] as const;
type Period = (typeof PERIODS)[number];

/** Зөвхөн өөрийн мөрүүд (SaleItem.staffId = би), буцаалт хассан, урамшуулал CommissionRule-оор */
export default async function MySalesPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requirePagePermission("me:read");
  const raw = (await searchParams).period;
  const period: Period = (PERIODS as readonly string[]).includes(raw ?? "") ? (raw as Period) : "month";
  // Цалингийн үеээр (1–15 / 16–сүүл) шүүж урамшууллын нийлбэрийг тулгана
  const { splitDay } = await getPayrollSettings();
  const month = ubDateKey().slice(0, 7);
  const range = period === "h1" || period === "h2" ? halfRange(month, period === "h1" ? 1 : 2, splitDay) : presetRange(period);
  const s = await mySales(user.id, range);
  const label = (p: Period) => (p === "h1" ? t.admin.payroll.att.half1(splitDay) : p === "h2" ? t.admin.payroll.att.half2(splitDay) : M.periods[p]);
  const empty = s.services.items.length === 0 && s.products.items.length === 0;

  const table = (title: string, items: typeof s.services.items) =>
    items.length > 0 && (
      <section>
        <h2 className="mb-3 font-display text-[20px] font-semibold">{title}</h2>
        <Table>
          <thead>
            <tr>
              <th className={thClass}>{M.name}</th>
              <th className={`${thClass} text-right`}>{M.qty}</th>
              <th className={`${thClass} text-right`}>{M.amount}</th>
              <th className={`${thClass} text-right`}>{M.commission}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.name}>
                <td className={tdClass}>{i.name}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{i.qty}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(i.amount)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(i.commission)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    );

  return (
    <>
      <div className="mb-5">
        <MeTabs active="sales" />
      </div>
      <PageHeader
        title={M.salesTitle}
        description={M.salesHint}
        actions={<SegmentedTabs label={M.salesTitle} value={period} items={PERIODS.map((p) => ({ value: p, label: label(p), href: `/admin/me/sales?period=${p}` }))} />}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          [M.services, formatMNT(s.services.amount), M.count(s.services.qty)],
          [M.products, formatMNT(s.products.amount), M.count(s.products.qty)],
          [M.commission, formatMNT(s.commission), null],
        ].map(([k, v, sub], i) => (
          <div key={k} className={`rounded-2xl border p-5 ${i === 2 ? "border-champagne/50 bg-champagne/[0.07]" : "border-hairline bg-white"}`}>
            <p className="text-[14px] text-ink-soft">{k}</p>
            <p className="mt-2 font-display text-[28px] font-semibold tabular-nums leading-none">{v}</p>
            {sub && <p className="mt-2 text-[13px] text-ink-soft">{sub}</p>}
          </div>
        ))}
      </div>
      {empty ? (
        <EmptyState icon={Receipt} title={M.noSales} />
      ) : (
        <div className="space-y-8">
          {table(M.services, s.services.items)}
          {table(M.products, s.products.items)}
        </div>
      )}
    </>
  );
}
