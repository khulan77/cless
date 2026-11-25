/** Нийтийн амралтын өдрүүд — ажлын өдрийн тоонд орохгүй. Батлагдсан цалинтай сард өөрчлөхгүй. */
import { z } from "zod";
import { t } from "@/i18n";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { fromDbDate, toDbDate } from "./dates";
import { assertMonthOpen, invalidateMonth } from "./locks";

const P = t.admin.payroll;

export async function listHolidays(opts: { from?: string; to?: string } = {}) {
  const rows = await db.holiday.findMany({
    where: { date: { ...(opts.from && { gte: toDbDate(opts.from) }), ...(opts.to && { lte: toDbDate(opts.to) }) } },
    orderBy: { date: "asc" },
  });
  return rows.map((h) => ({ id: h.id, date: fromDbDate(h.date), name: h.name }));
}

export async function holidaySet(from: string, to: string): Promise<Set<string>> {
  return new Set((await listHolidays({ from, to })).map((h) => h.date));
}

export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, P.badDate),
  name: z.string().trim().min(1, P.required).max(80),
});

export async function addHoliday(raw: z.input<typeof holidaySchema>, actorId: string) {
  const { date, name } = holidaySchema.parse(raw);
  await assertMonthOpen(date.slice(0, 7));
  if (await db.holiday.findUnique({ where: { date: toDbDate(date) } })) throw new UserError(P.holidayExists);
  return db.$transaction(async (tx) => {
    const h = await tx.holiday.create({ data: { date: toDbDate(date), name } });
    await invalidateMonth(date.slice(0, 7), tx);
    await audit(tx, { userId: actorId, action: "holiday.create", entity: "Holiday", entityId: h.id, after: { date, name } });
    return h;
  });
}

export async function removeHoliday(id: string, actorId: string) {
  const h = await db.holiday.findUnique({ where: { id } });
  if (!h) return;
  await assertMonthOpen(fromDbDate(h.date).slice(0, 7));
  await db.$transaction(async (tx) => {
    await tx.holiday.delete({ where: { id } });
    await invalidateMonth(fromDbDate(h.date).slice(0, 7), tx);
    await audit(tx, { userId: actorId, action: "holiday.delete", entity: "Holiday", entityId: id, before: { date: fromDbDate(h.date), name: h.name } });
  });
}
