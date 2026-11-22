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
  if (!hb) return { lastRunAt: null, minutesAgo: null, stale: true };
  const ms = now.getTime() - hb.lastRunAt.getTime();
  return { lastRunAt: hb.lastRunAt, minutesAgo: Math.max(0, Math.floor(ms / 60_000)), stale: ms > WORKER_STALE_MS };
}
