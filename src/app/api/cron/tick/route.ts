/**
 * POST /api/cron/tick — арын ажлын нэг давталт (PROMPT 22). Vercel дээр worker байхгүй тул гаднаас минут тутам:
 * Supabase pg_cron + pg_net (README), эсвэл cron-job.org. `Authorization: Bearer <CRON_SECRET>` (timing-safe).
 * Зэрэг дуудалт — нэг нь advisory lock-оор алгасна ({ skipped: true }). Нууц мэдээлэл буцаахгүй, зөвхөн тоо.
 */
import { NextResponse } from "next/server";
import { cronAuthorized } from "@/server/cron-auth";
import { runTick } from "@/server/modules/jobs/tick";

export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

async function handle(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const result = await runTick();
  return NextResponse.json(result, { headers: NO_STORE });
}

export const POST = handle;
export const GET = handle;
