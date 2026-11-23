/**
 * GET /api/health — uptime мониторинг ба Docker healthcheck.
 *   200 { status: "ok", db: "ok", worker: "ok" | "unknown", ... }
 *   503 DB холбогдохгүй, эсвэл worker-ийн heartbeat хуучирсан (`?scope=app` үед worker-ийг тооцохгүй —
 *       Docker-ийн app healthcheck үүнийг ашигладаг тул worker restart хийхэд app "unhealthy" болохгүй)
 *
 * Worker: Хулангийн `getWorkerHeartbeat()` (WorkerHeartbeat хүснэгт), босго `WORKER_STALE_MS` (5 мин,
 * хянах самбартай ижил). Мөр байхгүй (worker хэзээ ч ажиллаагүй) бол "unknown" — health-д нөлөөлөхгүй.
 *
 * Нууц мэдээлэл (холболтын мөр, алдааны дэлгэрэнгүй) буцаахгүй.
 */
import { NextResponse, connection, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { WORKER_STALE_MS, getWorkerHeartbeat } from "@/server/modules/outbox/heartbeat";

const DB_TIMEOUT_MS = 3_000;

type Check = "ok" | "fail" | "stale" | "unknown";

export async function GET(req: NextRequest) {
  await connection();
  const appOnly = req.nextUrl.searchParams.get("scope") === "app";
  const started = Date.now();

  let dbStatus: Check = "fail";
  let worker: Check = "unknown";
  let workerAgeSec: number | undefined;

  try {
    await withTimeout(db.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
    dbStatus = "ok";
    const hb = await withTimeout(getWorkerHeartbeat(), DB_TIMEOUT_MS);
    if (hb) {
      const ageMs = Math.max(0, Date.now() - hb.lastRunAt.getTime());
      workerAgeSec = Math.round(ageMs / 1000);
      worker = ageMs > WORKER_STALE_MS ? "stale" : "ok";
    }
  } catch {
    // DB алдааг дэлгэрэнгүйгүйгээр "fail" гэж л харуулна
    if (dbStatus !== "ok") dbStatus = "fail";
  }

  const healthy = dbStatus === "ok" && (appOnly || worker !== "stale");
  return NextResponse.json(
    {
      status: healthy ? "ok" : "error",
      db: dbStatus,
      worker,
      ...(workerAgeSec !== undefined && { workerAgeSec }),
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}
