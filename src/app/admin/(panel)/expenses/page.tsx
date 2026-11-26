import { ReceiptText } from "lucide-react";
import { ExpenseRowActions, NewExpenseButton, type CategoryOption } from "@/components/admin/finance/ExpenseForm";
import { PeriodPicker } from "@/components/admin/finance/PeriodPicker";
import { Badge, EmptyState, PageHeader, StatCard, Table, btnClass, inputClass, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { ubDateKey } from "@/lib/time";
import { requireFinancePage } from "@/server/modules/finance/access";
import { expenseCategories, lastReferences, listExpenses, monthlyTotals } from "@/server/modules/finance/expenses";
import { expenseFilterFrom } from "@/server/modules/finance/params";
import type { FinancePeriod } from "@/server/modules/finance/reports";

export const metadata = { title: "Зардал" };
export const instant = false;

type SP = Promise<Record<string, string | string[] | undefined>>;
const PAY = t.admin.payMethod as Record<string, string>;

export default async function ExpensesPage({ searchParams }: { searchParams: SP }) {
  const { canWrite } = await requireFinancePage("expenses");
  const f = expenseFilterFrom(await searchParams);
  const today = ubDateKey();
  const [rows, months, cats, lastRefs] = await Promise.all([listExpenses(f), monthlyTotals(f), expenseCategories({ includeInactive: true }), canWrite ? lastReferences() : Promise.resolve({})]);
  const categories: CategoryOption[] = cats.filter((c) => c.isActive).map((c) => ({ id: c.id, code: c.code, name: c.name, kind: c.kind, isSystem: c.isSystem }));
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const vat = rows.reduce((s, e) => s + e.vatAmount, 0);
  const qs = new URLSearchParams({ period: f.period, from: f.from, to: f.to, ...(f.categoryId ? { category: f.categoryId } : {}), ...(f.q ? { q: f.q } : {}) }).toString();

  return (
    <>
      <PageHeader
        eyebrow="Санхүү"
        title="Зардал"
        description="Ашиглалт, интернэт, нэмэлт зардал. Цалин, НДШ, ХХОАТ — цалингийн үе батлагдахад автоматаар."
        actions={
          <>
            <a href={`/api/admin/expenses/export?${qs}&format=csv`} className={btnClass("secondary")}>CSV</a>
            <a href={`/api/admin/expenses/export?${qs}&format=xlsx`} className={btnClass("secondary")}>XLSX</a>
            {canWrite && <NewExpenseButton categories={categories} lastRefs={lastRefs} today={today} />}
          </>
        }
      />
      <PeriodPicker base="/admin/expenses" period={f.period as FinancePeriod} range={{ from: f.from, to: f.to }} extra={{ category: f.categoryId, q: f.q }} />
      <form method="get" action="/admin/expenses" className="mb-6 flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="period" value={f.period} />
        <input type="hidden" name="from" value={f.from} />
        <input type="hidden" name="to" value={f.to} />
        <input type="hidden" name="date" value={f.to} />
        <select name="category" defaultValue={f.categoryId ?? ""} aria-label="Ангилал" className={`${inputClass} w-64`}>
          <option value="">Бүх ангилал</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={f.q ?? ""} placeholder="Код, нийлүүлэгч, тайлбараар" aria-label="Хайх" className={`${inputClass} w-64`} />
        <button type="submit" className={btnClass("secondary")}>{t.admin.filter}</button>
      </form>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Нийт (НӨАТ-тэй)" value={formatMNT(total)} hint={`${rows.length} мөр`} />
        <StatCard label="НӨАТ" value={formatMNT(vat)} />
        <StatCard label="Цэвэр (НӨАТ-гүй)" value={formatMNT(total - vat)} />
      </div>

      {months.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2 text-[13px] tabular-nums">
          {months.map((m) => (
            <span key={m.month} className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-hairline">
              {m.month}: <strong>{formatMNT(m.amount)}</strong>
            </span>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Зардал алга">Энэ хугацаанд бүртгэсэн зардал байхгүй.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>Огноо</th>
              <th className={thClass}>Ангилал</th>
              <th className={thClass}>Төлбөрийн код</th>
              <th className={thClass}>Нийлүүлэгч</th>
              <th className={`${thClass} text-right`}>Дүн</th>
              <th className={`${thClass} text-right`}>НӨАТ</th>
              <th className={thClass}>Төлсөн</th>
              <th className={thClass}>Баримт</th>
              {canWrite && <th className={thClass}><span className="sr-only">Үйлдэл</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-canvas">
                <td className={`${tdClass} tabular-nums`}>{e.date}</td>
                <td className={tdClass}>
                  <span className="font-mono text-[12px] text-ink-soft">{e.category.code}</span> {e.category.name}
                  {e.category.isSystem && <span className="ml-2"><Badge>Автомат</Badge></span>}
                  {e.note && <p className="text-[13px] text-ink-soft">{e.note}</p>}
                </td>
                <td className={`${tdClass} font-mono text-[13px]`}>{e.reference ?? "—"}</td>
                <td className={tdClass}>{e.vendor ?? "—"}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(e.amount)}</td>
                <td className={`${tdClass} text-right tabular-nums text-ink-soft`}>{e.vatAmount ? formatMNT(e.vatAmount) : "—"}</td>
                <td className={tdClass}>{e.paidVia ? (PAY[e.paidVia] ?? e.paidVia) : "—"}</td>
                <td className={tdClass}>
                  {e.hasReceipt ? (
                    <a href={`/api/admin/expenses/${e.id}/receipt`} target="_blank" rel="noreferrer" className="underline">Харах</a>
                  ) : (
                    "—"
                  )}
                </td>
                {canWrite && (
                  <td className={tdClass}>
                    {!e.category.isSystem && !e.payrollPeriodId && (
                      <ExpenseRowActions
                        expense={{ id: e.id, date: e.date, categoryId: e.category.id, amount: e.amount, vatIncluded: e.vatIncluded, reference: e.reference, vendor: e.vendor, note: e.note, paidVia: e.paidVia, hasReceipt: e.hasReceipt }}
                        categories={categories}
                        lastRefs={lastRefs}
                        today={today}
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
