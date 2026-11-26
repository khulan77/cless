/**
 * Outbox: гадны дуудлагатай ажлыг (имэйл, QPay invoice цуцлах …) transaction-тай
 * хамт DB-д бичээд, worker тусад нь гүйцэтгэнэ. dedupeKey давхардлаас хамгаална.
 */
import { drainSoon } from "./drain";
import type { JobType, Prisma } from "@/generated/prisma/client";

export const MAX_ATTEMPTS = 5;

/** Ижил dedupeKey-тэй ажил байвал шинээр үүсгэхгүй. Үүссэн эсэхийг буцаана. */
export async function enqueue(
  tx: Prisma.TransactionClient,
  job: { type: JobType; payload: Prisma.InputJsonValue; dedupeKey?: string; runAfter?: Date },
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "OutboxJob" ("id", "type", "payload", "dedupeKey", "runAfter", "updatedAt")
    VALUES (${`job_${crypto.randomUUID()}`}, ${job.type}::"JobType", ${JSON.stringify(job.payload)}::jsonb,
            ${job.dedupeKey ?? null}, ${job.runAfter ?? new Date()}, (now() AT TIME ZONE 'UTC'))
    ON CONFLICT ("dedupeKey") DO NOTHING
    RETURNING "id"`;
  // Шууд (минут хүлээлгүй) илгээх — хүсэлтийн хариуны дараа; хугацаатай ажлыг (runAfter) tick илгээнэ
  if (rows.length > 0 && (!job.runAfter || job.runAfter.getTime() <= Date.now() + 1000)) drainSoon();
  return rows.length > 0;
}

/** Exponential backoff: 30с, 1м, 2м, 4м, 8м … (дээд тал 1 цаг) */
export function backoffMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 60 * 60 * 1000);
}
