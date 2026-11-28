import { PeriodPicker } from "@/components/admin/finance/PeriodPicker";
import { EmptyState, PageHeader, Table, tdClass, thClass } from "@/components/admin/ui";
import { formatMNT } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";
import { dailyCash } from "@/server/modules/finance/daily-cash";
import { financeRange } from "@/server/modules/finance/reports";
import { Wallet } from "lucide-react";

export const metadata = { title: "Өдрийн касс" };
export const instant = false;

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const money = (n: number | undefined) => (n ? formatMNT(n) : "—");

/** Кассын ээлжийн оронд (PROMPT 20): огноо × бүртгэсэн хүн × төлбөрийн хэлбэр, буцаалт хассан */
export default async function DailyCashPage({ searchParams }: { searchParams: SP }) {
  await requirePagePermission("sale:read");
  const sp = await searchParams;
  const { period, range } = financeRange({ period: one(sp.period) ?? "day", date: one(sp.date), from: one(sp.from), to: one(sp.to) });
  const { rows, totals, columns } = await dailyCash(range);
  return (
    <>
      <PageHeader eyebrow="Касс" title="Өдрийн касс" description="Бүртгэсэн хүн бүрээр, төлбөрийн хэлбэрээр — буцаалт хассан. Кассын ээлжийн оронд." />
      <PeriodPicker base="/admin/reports/daily-cash" period={period} range={range} />
      {rows.length === 0 ? (
        <EmptyState icon={Wallet} title="Төлбөр алга">Энэ хугацаанд төлбөр бүртгэгдээгүй.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>Огноо</th>
              <th className={thClass}>Бүртгэсэн</th>
              {columns.map((c) => (
                <th key={c.key} className={`${thClass} text-right`}>{c.label}</th>
              ))}
              <th className={`${thClass} text-right`}>Буцаалт</th>
              <th className={`${thClass} text-right`}>Нийт (цэвэр)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.day}${r.userId}`}>
                <td className={`${tdClass} tabular-nums`}>{r.day}</td>
                <td className={tdClass}>{r.name}</td>
                {columns.map(({ key: m }) => (
                  <td key={m} className={`${tdClass} text-right tabular-nums`}>{money(r.byMethod[m])}</td>
                ))}
                <td className={`${tdClass} text-right tabular-nums text-ink-soft`}>{r.refunds ? `−${formatMNT(r.refunds)}` : "—"}</td>
                <td className={`${tdClass} text-right font-medium tabular-nums`}>{formatMNT(r.net)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className={tdClass} colSpan={2}>Нийт</td>
              {columns.map(({ key: m }) => (
                <td key={m} className={`${tdClass} text-right tabular-nums`}>{money(totals[m])}</td>
              ))}
              <td className={`${tdClass} text-right tabular-nums`}>{totals.refunds ? `−${formatMNT(totals.refunds)}` : "—"}</td>
              <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(totals.net)}</td>
            </tr>
          </tbody>
        </Table>
      )}
    </>
  );
}
