/**
 * Тайлангийн тодорхойлолт — бүх тоо ЭНД тайлбарласны дагуу тооцогдоно (queries.ts).
 *
 * Хугацаа
 *   Улаанбаатарын өдрөөр (Asia/Ulaanbaatar). Борлуулалтыг ТӨЛӨГДСӨН огноогоор нь (`Sale.paidAt`)
 *   тоолно; хамрах төлөв: PAID, PARTIALLY_REFUNDED, REFUNDED.
 *
 * Орсон орлого
 *   = тэдгээр борлуулалтын мөрийн дүн (`SaleItem.lineTotal` — мөрийн болон борлуулалтын хөнгөлөлт
 *     хуваарилагдсаны дараах) − дууссан (COMPLETED) буцаалтын мөрийн дүн (`Refund.items[].amount`).
 *   НӨАТ багтсан. НӨАТ-гүй дүн = орлого − (мөрийн НӨАТ × үлдсэн хувь).
 *   Буцаалт нь ЗАРСАН хугацаандаа хасагдана (дараа сард буцаасан ч) — тиймээс үйлчилгээ,
 *   бүтээгдэхүүн, ажилтны задаргаа нийт орлоготой үргэлж тэнцэнэ.
 *
 * Үйлчилгээний / бүтээгдэхүүний орлого
 *   = дээрхийг мөрийн төрлөөр (`SaleItem.kind`) хуваасан. Үйлчилгээ + Бүтээгдэхүүн = Нийт.
 *
 * Хүлээгдэж буй
 *   = хэсэгчлэн төлсөн (PARTIALLY_PAID) борлуулалтын үлдэгдэл (`total − paidAmount`),
 *   борлуулалт үүссэн огноогоор (`createdAt`) — `paidAt` хараахан байхгүй.
 *
 * Борлуулалт = дээрх борлуулалтын тоо.  Дундаж дүн = орсон орлого / борлуулалт.
 * Буцаалт = эдгээр борлуулалтын дууссан буцаалтын дүн ба тоо.
 * Цаг = эхлэх цагаар (`Appointment.startsAt`): дууссан (DONE), ирээгүй (NO_SHOW), цуцалсан (CANCELLED).
 * Ажилтнаар = мөрийн `staffId` (үйлчилгээнд заавал). Ажилтангүй мөр → "Тодорхойгүй" — зохиохгүй.
 * Төлбөрийн хэлбэр = амжилттай төлбөр − тухайн хэлбэрээр хийсэн дууссан буцаалт.
 * Өртөг, ашиг = `unitCostSnapshot × үлдсэн тоо` — зөвхөн `cost:read` эрхтэй (ADMIN).
 * Харьцуулалт = яг ижил урттай өмнөх хугацаа.
 */
import { addDays, isDateKey, ubDateKey, ubDayRange } from "@/lib/time";

export const REPORT_SALE_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

export type ReportPreset = "today" | "week" | "month" | "lastMonth";
export type ReportRange = { from: string; to: string };

/** Inclusive UB day keys → [start, end) instants */
export function rangeBounds(r: ReportRange) {
  return { start: ubDayRange(r.from).start, end: ubDayRange(r.to).end };
}

export function dayCount(r: ReportRange): number {
  return Math.round((ubDayRange(r.to).end.getTime() - ubDayRange(r.from).start.getTime()) / 86_400_000);
}

/** All day keys in the range (chart x-axis) */
export function daysOf(r: ReportRange): string[] {
  const out: string[] = [];
  for (let d = r.from; d <= r.to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

export function presetRange(p: ReportPreset, today = ubDateKey()): ReportRange {
  const monthStart = `${today.slice(0, 8)}01`;
  if (p === "today") return { from: today, to: today };
  if (p === "week") return { from: addDays(today, -6), to: today };
  if (p === "lastMonth") {
    const lastEnd = addDays(monthStart, -1);
    return { from: `${lastEnd.slice(0, 8)}01`, to: lastEnd };
  }
  return { from: monthStart, to: today };
}

/** ?from=&to= (or ?preset=) → a valid range; default this month; at most ~1 year */
export function rangeFromParams(sp: { from?: string; to?: string; preset?: string }, today = ubDateKey()): { range: ReportRange; preset: ReportPreset | null } {
  const preset = (["today", "week", "month", "lastMonth"] as const).find((p) => p === sp.preset) ?? null;
  if (sp.from && sp.to && isDateKey(sp.from) && isDateKey(sp.to)) {
    const [first, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    let from = first;
    if (dayCount({ from, to }) > 370) from = addDays(to, -369);
    const match = (["today", "week", "month", "lastMonth"] as const).find((p) => {
      const r = presetRange(p, today);
      return r.from === from && r.to === to;
    });
    return { range: { from, to }, preset: match ?? null };
  }
  const p = preset ?? "month";
  return { range: presetRange(p, today), preset: p };
}

/** The same number of days immediately before */
export function previousRange(r: ReportRange): ReportRange {
  const n = dayCount(r);
  return { from: addDays(r.from, -n), to: addDays(r.from, -1) };
}

/** ▲/▼ % vs. the previous period; null when there is nothing to compare with */
export function change(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null;
  return Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
}
