/**
 * GET /api/health — uptime мониторинг ба Docker healthcheck.
 *   200 { status: "ok", db: "ok", worker: "unknown", ... }
 *   503 DB холбогдохгүй (`?scope=app` үед worker-ийг тооцохгүй — worker шалгалт нэмэгдсэний дараа хамаатай)
 *
 * Нууц мэдээлэл (холболтын мөр, алдааны дэлгэрэнгүй) буцаахгүй.
 *
 * TODO(worker-heartbeat): Хулангийн `getWorkerHeartbeat()` (src/server/.../heartbeat.ts) main-д merge
 *   хийгдсэний дараа (rebase) worker шалгалтыг нэмнэ. SiteSetting-ээс УНШИХГҮЙ — тэр функцийг ашиглана.
 *   Босго: `WORKER_STALE_MS`-ийг heartbeat.ts-ээс IMPORT хийнэ (5 минут, хянах самбартай ижил) —
 *   энд дахин тодорхойлохгүй, route-оос export хийхгүй. Хуучирсан бол worker = "stale",
 *   `scope=app` биш үед 503. Тэр хүртэл worker = "unknown" бөгөөд health-д нөлөөлөхгүй.
 */
import { NextResponse, connection, type NextRequest } from "next/server";
import { db } from "@/server/db";

const DB_TIMEOUT_MS = 3_000;

type Check = "ok" | "fail" | "stale" | "unknown";

export async function GET(req: NextRequest) {
  await connection();
  const appOnly = req.nextUrl.searchParams.get("scope") === "app";
  const started = Date.now();

  let dbStatus: Check = "fail";
  // TODO(worker-heartbeat): getWorkerHeartbeat()-ийг heartbeat.ts-ийн WORKER_STALE_MS-тэй харьцуулж "ok" | "stale" тооцно.
  const worker: Check = "unknown";

  try {
    await withTimeout(db.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
    dbStatus = "ok";
  } catch {
    dbStatus = "fail";
  }

  // TODO(worker-heartbeat): `&& (appOnly || worker !== "stale")` нэмнэ.
  void appOnly;
  const healthy = dbStatus === "ok";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "error",
      db: dbStatus,
      worker,
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}
