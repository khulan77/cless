/**
 * Тайлан → Цуцлалт (A6). Зөвхөн уншина. Огноо = цагийн эхлэх өдөр (УБ), [from, to] хүрээнд.
 * Хуучин (A6-аас өмнөх) цуцлалтад ангилал, цуцалсан хүн байхгүй — "Тодорхойгүй".
 */
import { db } from "@/server/db";
import { CANCEL_CATEGORIES, isCancelCategory, type CancelCategory } from "@/server/modules/appointments/cancel";
import { rangeBounds, type ReportRange } from "./definitions";

export type CancellationRow = {
  id: string;
  startsAt: Date;
  customer: { id: string; name: string };
  staff: string;
  service: string;
  cancelledBy: string | null;
  cancelledAt: Date | null;
  category: CancelCategory | null;
  reason: string | null;
};

export async function listCancellations(range: ReportRange, filter: { staffId?: string | null; category?: string | null } = {}) {
  const { start, end } = rangeBounds(range);
  const category = filter.category && isCancelCategory(filter.category) ? filter.category : null;
  const rows = await db.appointment.findMany({
    where: {
      status: "CANCELLED",
      startsAt: { gte: start, lt: end },
      ...(filter.staffId ? { staffId: filter.staffId } : {}),
      ...(category ? { cancelCategory: category } : {}),
    },
    orderBy: { startsAt: "desc" },
    take: 1000,
    select: {
      id: true,
      startsAt: true,
      cancelReason: true,
      cancelCategory: true,
      cancelledAt: true,
      customer: { select: { id: true, name: true } },
      staff: { select: { name: true } },
      service: { select: { name: true } },
      cancelledBy: { select: { name: true } },
    },
  });
  const list: CancellationRow[] = rows.map((r) => ({
    id: r.id,
    startsAt: r.startsAt,
    customer: r.customer,
    staff: r.staff.name,
    service: r.service.name,
    cancelledBy: r.cancelledBy?.name ?? null,
    cancelledAt: r.cancelledAt,
    category: isCancelCategory(r.cancelCategory) ? r.cancelCategory : null,
    reason: r.cancelReason,
  }));
  const byCategory = [...CANCEL_CATEGORIES, null].map((c) => ({ category: c, count: list.filter((r) => r.category === c).length })).filter((x) => x.count > 0);
  return { rows: list, byCategory };
}
