/**
 * Календарийн толгой/доод мөрийн тоо (ЗӨВХӨН уншина): цаг бүрийн үнэ, төлөгдсөн дүн,
 * тухайн хугацааны цуцлагдсан цагийн тоо.
 */
import { db } from "@/server/db";

export async function calendarMoney(range: { start: Date; end: Date }, staffId?: string | null) {
  const where = { startsAt: { gte: range.start, lt: range.end }, ...(staffId ? { staffId } : {}) };
  const [appts, cancelled] = await Promise.all([
    db.appointment.findMany({
      where: { ...where, status: { not: "CANCELLED" } },
      select: {
        id: true,
        priceSnapshot: true,
        sales: { where: { status: { notIn: ["DRAFT", "CANCELLED"] } }, select: { paidAmount: true, refundedAmount: true } },
      },
    }),
    db.appointment.count({ where: { ...where, status: "CANCELLED" } }),
  ]);
  const money: Record<string, { price: number; paid: number }> = {};
  for (const a of appts) {
    money[a.id] = { price: a.priceSnapshot, paid: a.sales.reduce((s, x) => s + x.paidAmount - x.refundedAmount, 0) };
  }
  return { money, cancelled };
}

/** Тайлан: хугацааны цагуудыг эх сурвалжаар (утас, Instagram, онлайн…) — цуцлагдсаныг оруулахгүй */
export async function apptSourceBreakdown(range: { start: Date; end: Date }) {
  const rows = await db.appointment.groupBy({
    by: ["source"],
    where: { startsAt: { gte: range.start, lt: range.end }, status: { notIn: ["CANCELLED"] } },
    _count: true,
  });
  return rows.map((r) => ({ source: r.source, count: r._count })).sort((a, b) => b.count - a.count);
}
