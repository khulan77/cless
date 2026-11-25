/**
 * Тайлан → Цалин (PROMPT 14 §9): сараар цалингийн зардал (gross + ажил олгогчийн НДШ), ажилтнаар,
 * үйлчилгээний орлоготой харьцуулсан хувь. Зөвхөн батлагдсан / олгосон үе. Сар = үеийн эхлэх огнооны сар.
 */
import { db } from "@/server/db";
import { loadReport } from "@/server/modules/reports/queries";
import { monthDays } from "./calc";
import { fromDbDate, toDbDate } from "./dates";

export async function payrollReport(year: number) {
  const lines = await db.payrollLine.findMany({
    where: { period: { status: { in: ["APPROVED", "PAID"] }, startDate: { gte: toDbDate(`${year}-01-01`), lte: toDbDate(`${year}-12-31`) } } },
    select: { staffId: true, gross: true, siEmployer: true, net: true, staff: { select: { name: true } }, period: { select: { startDate: true } } },
  });
  const months = new Map<string, { gross: number; siEmployer: number; net: number }>();
  const staff = new Map<string, { name: string; gross: number; siEmployer: number; net: number }>();
  for (const l of lines) {
    const m = fromDbDate(l.period.startDate).slice(0, 7);
    const a = months.get(m) ?? { gross: 0, siEmployer: 0, net: 0 };
    a.gross += l.gross;
    a.siEmployer += l.siEmployer;
    a.net += l.net;
    months.set(m, a);
    const s = staff.get(l.staffId) ?? { name: l.staff.name, gross: 0, siEmployer: 0, net: 0 };
    s.gross += l.gross;
    s.siEmployer += l.siEmployer;
    s.net += l.net;
    staff.set(l.staffId, s);
  }
  const keys = [...months.keys()].sort();
  const revenue = await Promise.all(
    keys.map(async (m) => {
      const d = monthDays(m);
      const r = await loadReport({ from: d[0]!, to: d.at(-1)! }, { canCost: false });
      return r.kpi.service;
    }),
  );
  const byMonth = keys.map((m, i) => {
    const a = months.get(m)!;
    const cost = a.gross + a.siEmployer;
    const service = revenue[i]!;
    return { month: m, ...a, cost, service, ratio: service > 0 ? cost / service : null };
  });
  const byStaff = [...staff.values()].map((s) => ({ ...s, cost: s.gross + s.siEmployer })).sort((a, b) => b.cost - a.cost);
  const totals = byMonth.reduce((t, m) => ({ cost: t.cost + m.cost, service: t.service + m.service, gross: t.gross + m.gross, siEmployer: t.siEmployer + m.siEmployer }), { cost: 0, service: 0, gross: 0, siEmployer: 0 });
  return { year, byMonth, byStaff, totals: { ...totals, ratio: totals.service > 0 ? totals.cost / totals.service : null } };
}
