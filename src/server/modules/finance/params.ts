/** URL параметр → зардлын шүүлт (хуудас ба экспорт ижил) */
import { ubDateKey } from "@/lib/time";
import type { ExpenseFilter } from "./expenses";
import { financeRange } from "./reports";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export function expenseFilterFrom(sp: SP, today = ubDateKey()): ExpenseFilter & { period: string } {
  const { period, range } = financeRange({ period: one(sp.period) ?? (one(sp.from) && one(sp.to) ? "custom" : "month"), date: one(sp.date), from: one(sp.from), to: one(sp.to) }, today);
  return { period, ...range, categoryId: one(sp.category) ?? null, q: one(sp.q)?.trim().slice(0, 100) || null };
}

export function searchParamsObject(url: URL): SP {
  return Object.fromEntries(url.searchParams.entries());
}
