/** Батлагдсан (APPROVED / PAID) цалингийн үеийн ирц, амралтын өдөр, нэмэлт/хасалт түгжигдэнэ */
import { t } from "@/i18n";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { monthDays, monthOf } from "./calc";
import { toDbDate } from "./dates";

const P = t.admin.payroll;

export async function lockedPeriodFor(day: string) {
  return db.payrollPeriod.findFirst({
    where: { status: { in: ["APPROVED", "PAID"] }, startDate: { lte: toDbDate(day) }, endDate: { gte: toDbDate(day) } },
    select: { id: true },
  });
}

export async function assertDayOpen(day: string) {
  if (await lockedPeriodFor(day)) throw new UserError(P.dayLocked);
}

/** Амралтын өдөр сарын төлөвлөсөн өдрийг өөрчилнө — тухайн сард батлагдсан үе байвал хориглоно */
export async function assertMonthOpen(month: string) {
  const days = monthDays(month);
  const hit = await db.payrollPeriod.findFirst({
    where: { status: { in: ["APPROVED", "PAID"] }, startDate: { lte: toDbDate(days.at(-1)!) }, endDate: { gte: toDbDate(days[0]!) } },
    select: { id: true },
  });
  if (hit) throw new UserError(P.monthLocked);
}

// ───────────── Ноорог үеийн тооцоог хүчингүй болгох (calculatedAt = null → батлахаас өмнө дахин тооцоолно) ─────────────

type Tx = Prisma.TransactionClient | typeof db;

/** Тухайн өдөрт хамаарах ноорог үе + тухайн сарын FINAL (бүтэн сараар бодогддог) */
export async function invalidateDay(day: string, tx: Tx = db) {
  const md = monthDays(monthOf(day));
  await tx.payrollPeriod.updateMany({
    where: {
      status: "DRAFT",
      calculatedAt: { not: null },
      OR: [
        { startDate: { lte: toDbDate(day) }, endDate: { gte: toDbDate(day) } },
        { kind: "FINAL", startDate: { gte: toDbDate(md[0]!) }, endDate: { lte: toDbDate(md.at(-1)!) } },
      ],
    },
    data: { calculatedAt: null },
  });
}

/** Сарын бүх ноорог үе (амралтын өдөр — сарын төлөвлөсөн өдрийг өөрчилнө) */
export async function invalidateMonth(month: string, tx: Tx = db) {
  const md = monthDays(month);
  await tx.payrollPeriod.updateMany({
    where: { status: "DRAFT", calculatedAt: { not: null }, startDate: { lte: toDbDate(md.at(-1)!) }, endDate: { gte: toDbDate(md[0]!) } },
    data: { calculatedAt: null },
  });
}

/** Тухайн өдрөөс хойш дуусах бүх ноорог үе (цалин, хувь хэмжээ өөрчлөгдөхөд) */
export async function invalidateFrom(day: string, tx: Tx = db) {
  await tx.payrollPeriod.updateMany({ where: { status: "DRAFT", calculatedAt: { not: null }, endDate: { gte: toDbDate(day) } }, data: { calculatedAt: null } });
}
