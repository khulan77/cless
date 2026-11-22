/**
 * Outbox хяналт (ADMIN → Систем): амжилтгүй / удаан хүлээгдэж буй ажлууд, дахин оролдох.
 */
import type { JobType } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";

/** Үүнээс удаан PENDING/PROCESSING байвал "удаан" */
export const SLOW_JOB_MS = 10 * 60 * 1000;

export async function problemJobs(now = new Date()) {
  const slowBefore = new Date(now.getTime() - SLOW_JOB_MS);
  const [failed, slow, counts] = await Promise.all([
    db.outboxJob.findMany({ where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.outboxJob.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] }, runAfter: { lt: slowBefore }, createdAt: { lt: slowBefore } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    db.outboxJob.groupBy({ by: ["status"], _count: true }),
  ]);
  return { failed, slow, counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number> };
}

/** Хянах самбар (MANAGER-т ч): имэйл илгээж чадаагүй ажлын тоо */
export async function failedEmailCount() {
  return db.outboxJob.count({ where: { status: "FAILED", type: { in: ["VISIT_EMAIL", "APPT_EMAIL", "APPT_REMINDER", "EMAIL"] as JobType[] } } });
}

/** Амжилтгүй / гацсан ажлыг дахин дараалалд оруулна (attempts 0) */
export async function retryJob(id: string, actorId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const job = await tx.outboxJob.findUnique({ where: { id } });
    if (!job) throw new UserError("Ажил олдсонгүй.");
    if (job.status === "DONE") throw new UserError("Энэ ажил аль хэдийн амжилттай болсон.");
    await tx.outboxJob.update({ where: { id }, data: { status: "PENDING", attempts: 0, runAfter: now, lockedAt: null } });
    // Айлчлалын имэйл: UI-д "Дараалалд" гэж харагдана
    const visitId = (job.payload as { visitId?: string } | null)?.visitId;
    if (job.type === "VISIT_EMAIL" && visitId) {
      await tx.visit.updateMany({ where: { id: visitId }, data: { emailStatus: "QUEUED", emailError: null } });
    }
    await audit(tx, { userId: actorId, action: "outbox.retry", entity: "OutboxJob", entityId: id, before: { status: job.status, attempts: job.attempts, lastError: job.lastError } });
  });
}
