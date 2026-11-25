/**
 * Outbox worker-ийн цөм (Next-ээс хамааралгүй, тестлэгдэнэ). `bun run worker` → src/worker/index.ts.
 *  - FOR UPDATE SKIP LOCKED-оор ажил авна (олон worker зэрэг ажиллаж болно)
 *  - Алдаа → exponential backoff; MAX_ATTEMPTS-ийн дараа FAILED
 *  - Удаан PROCESSING-д гацсан ажлыг (worker унасан) буцааж PENDING болгоно
 */
import type { OutboxJob } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { deliverAppointmentSms, type ApptSmsPayload } from "@/server/modules/notifications/appointment-sms";
import { deliverAppointmentEmail, type ApptJobPayload } from "@/server/modules/notifications/appointment-delivery";
import { deliverInquiryEmail } from "@/server/modules/notifications/inquiry-delivery";
import { deliverVisitEmail, markVisitEmailFailed } from "@/server/modules/notifications/service";
import { getQPayProvider } from "@/server/modules/payments/providers/qpay";
import { deliverAccountantReport, markAccountantFailed } from "@/server/modules/reports/accountant";
import { MAX_ATTEMPTS, backoffMs } from "./service";

type Handler = { run: (job: OutboxJob) => Promise<void>; onFinalFailure?: (job: OutboxJob, error: string) => Promise<void> };

const payload = (job: OutboxJob) => (job.payload ?? {}) as Record<string, string>;

export const handlers: Partial<Record<OutboxJob["type"], Handler>> = {
  VISIT_EMAIL: {
    run: async (job) => {
      await deliverVisitEmail(job.id, payload(job).visitId!, payload(job).customerEmailId);
    },
    onFinalFailure: (job, error) => markVisitEmailFailed(payload(job).visitId!, error, payload(job).customerEmailId),
  },
  APPT_EMAIL: {
    run: async (job) => {
      await deliverAppointmentEmail(job.id, job.payload as unknown as ApptJobPayload);
    },
  },
  APPT_REMINDER: {
    // Имэйл (имэйлтэй бол) + SMS. Аль аль нь idempotency key-тэй тул дахин оролдлогод давхардахгүй.
    run: async (job) => {
      await deliverAppointmentEmail(job.id, job.payload as unknown as ApptJobPayload);
      await deliverAppointmentSms(`${job.id}:sms`, job.payload as unknown as ApptSmsPayload);
    },
  },
  SMS: {
    run: async (job) => {
      await deliverAppointmentSms(job.id, job.payload as unknown as ApptSmsPayload);
    },
  },
  INQUIRY_EMAIL: {
    run: async (job) => {
      await deliverInquiryEmail(job.id, payload(job).inquiryId!);
    },
  },
  ACCOUNTANT_REPORT: {
    run: async (job) => {
      await deliverAccountantReport(job.id, payload(job).dispatchId!);
    },
    onFinalFailure: (job, error) => markAccountantFailed(payload(job).dispatchId!, error),
  },
  QPAY_CANCEL_INVOICE: {
    run: async (job) => {
      await getQPayProvider().cancelInvoice(payload(job).invoiceId!);
    },
  },
};

export const STUCK_AFTER_MS = 10 * 60 * 1000;

/** Worker унасан үед PROCESSING-д үлдсэн ажлыг сэргээнэ */
export async function recoverStuckJobs(now = new Date()) {
  return db.$executeRaw`
    UPDATE "OutboxJob" SET "status" = 'PENDING', "lockedAt" = NULL, "updatedAt" = (now() AT TIME ZONE 'UTC')
    WHERE "status" = 'PROCESSING' AND "lockedAt" < ${new Date(now.getTime() - STUCK_AFTER_MS)}`;
}

/** PENDING ажлуудыг атомаар авч PROCESSING болгоно */
export async function claimJobs(limit = 10, now = new Date()): Promise<OutboxJob[]> {
  return db.$queryRaw<OutboxJob[]>`
    UPDATE "OutboxJob" SET "status" = 'PROCESSING', "lockedAt" = ${now}, "attempts" = "attempts" + 1, "updatedAt" = (now() AT TIME ZONE 'UTC')
    WHERE "id" IN (
      SELECT "id" FROM "OutboxJob"
      WHERE "status" = 'PENDING' AND "runAfter" <= ${now}
      ORDER BY "runAfter" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

export async function runJob(job: OutboxJob, now = new Date()) {
  const handler = handlers[job.type];
  try {
    if (!handler) throw new Error(`Handler алга: ${job.type}`);
    await handler.run(job);
    await db.outboxJob.update({ where: { id: job.id }, data: { status: "DONE", lockedAt: null, lastError: null } });
    return "DONE" as const;
  } catch (e) {
    const error = String(e instanceof Error ? e.message : e).slice(0, 1000);
    const final = job.attempts >= MAX_ATTEMPTS || !handler;
    await db.outboxJob.update({
      where: { id: job.id },
      data: final
        ? { status: "FAILED", lockedAt: null, lastError: error }
        : { status: "PENDING", lockedAt: null, lastError: error, runAfter: new Date(now.getTime() + backoffMs(job.attempts)) },
    });
    if (final) await handler?.onFinalFailure?.(job, error).catch(() => undefined);
    return final ? ("FAILED" as const) : ("RETRY" as const);
  }
}

/** Нэг давталт: сэргээх → авах → гүйцэтгэх. Гүйцэтгэсэн ажлын тоо. */
export async function processOutbox(limit = 10, now = new Date()) {
  await recoverStuckJobs(now);
  const jobs = await claimJobs(limit, now);
  for (const job of jobs) await runJob(job, now);
  return jobs.length;
}
