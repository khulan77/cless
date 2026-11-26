/**
 * Хэт хуучирсан мэдэгдлийг илгээхгүй (PROMPT 22): worker ажиллаагүй хугацаанд (≈4 хоног) хуримтлагдсан
 * SMS / цагийн имэйл / сануулга бодит хүнд хожуу очихоос сэргийлнэ → SKIPPED.
 *  - SMS, APPT_EMAIL: runAfter 4 хоногоос хуучин
 *  - APPT_REMINDER: runAfter 24 цагаас хуучин (цаг аль хэдийн өнгөрсөн) эсвэл 4 хоногоос хуучин
 * Бусад төрлийг (тайлан, QPay цуцлах, айлчлалын имэйл) хөндөхгүй.
 */
import { db } from "@/server/db";

export const STALE_NOTIFY_MS = 4 * 86_400_000;
export const STALE_REMINDER_MS = 86_400_000;

const where = (now: Date) => ({
  status: "PENDING" as const,
  OR: [
    { type: { in: ["SMS" as const, "APPT_EMAIL" as const] }, runAfter: { lt: new Date(now.getTime() - STALE_NOTIFY_MS) } },
    { type: "APPT_REMINDER" as const, runAfter: { lt: new Date(now.getTime() - STALE_REMINDER_MS) } },
  ],
});

/** Dry-run: төрлөөр тоо */
export async function countStaleNotifications(now = new Date()) {
  const rows = await db.outboxJob.groupBy({ by: ["type"], where: where(now), _count: true });
  return rows.map((r) => ({ type: r.type, count: r._count }));
}

export async function skipStaleNotifications(now = new Date()) {
  const r = await db.outboxJob.updateMany({ where: where(now), data: { status: "SKIPPED", lockedAt: null, lastError: "SKIPPED: хэт хуучирсан (worker ажиллаагүй хугацаанд)" } });
  return r.count;
}
