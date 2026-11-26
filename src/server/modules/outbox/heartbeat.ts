/**
 * Worker-ийн heartbeat: хянах самбарт "сүүлд ажилласан N минутын өмнө".
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export const WORKER_ID = "worker";
/** Үүнээс удаан heartbeat ирээгүй бол анхааруулна */
export const WORKER_STALE_MS = 5 * 60 * 1000;

export async function beat(info: Prisma.InputJsonValue = {}, now = new Date()) {
  await db.workerHeartbeat.upsert({
    where: { id: WORKER_ID },
    create: { id: WORKER_ID, lastRunAt: now, info },
    update: { lastRunAt: now, info },
  });
}

/** WorkerHeartbeat мөр (lastRunAt, info, updatedAt) — байхгүй бол null. Heartbeat-ийн цорын ганц эх сурвалж; /api/health үүнийг ашиглана. */
export async function getWorkerHeartbeat() {
  return db.workerHeartbeat.findUnique({ where: { id: WORKER_ID } });
}

export async function workerStatus(now = new Date()) {
  const hb = await getWorkerHeartbeat();
  if (!hb) return { lastRunAt: null, minutesAgo: null, secondsAgo: null, source: null, stale: true };
  const ms = now.getTime() - hb.lastRunAt.getTime();
  // PROMPT 22: Vercel дээр worker-ийн оронд cron tick heartbeat бичнэ ({ source: "cron" })
  const source = (hb.info as { source?: string } | null)?.source === "cron" ? ("cron" as const) : ("worker" as const);
  return { lastRunAt: hb.lastRunAt, minutesAgo: Math.max(0, Math.floor(ms / 60_000)), secondsAgo: Math.max(0, Math.round(ms / 1000)), source, stale: ms > WORKER_STALE_MS };
}

/** "40 сек", "3 мин", "4 цаг", "2 өдөр" */
export function agoLabel(seconds: number) {
  if (seconds < 90) return `${seconds} сек`;
  if (seconds < 90 * 60) return `${Math.round(seconds / 60)} мин`;
  if (seconds < 48 * 3600) return `${Math.round(seconds / 3600)} цаг`;
  return `${Math.round(seconds / 86_400)} өдөр`;
}
