/**
 * Өдөр бүр 23:50 (УБ) — Vercel Cron (vercel.json: "50 15 * * *" UTC). Worker байхгүй орчинд:
 *  - "Явлаа" дараагүй сессийг хуваарийн дуусах цагаар хаана (AUTO_CLOSE, flagged) — давхардалгүй
 *  - 90 хоногоос хуучин байршлыг (lat/lng) устгана
 * CRON_SECRET-ээр хамгаалагдсан (Authorization: Bearer …).
 */
import { NextResponse } from "next/server";
import { cronAuthorized } from "@/server/cron-auth";
import { autoCloseOpenSessions, purgeOldCoordinates } from "@/server/modules/attendance/service";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const [closed, purged] = [await autoCloseOpenSessions(), await purgeOldCoordinates()];
  return NextResponse.json({ ok: true, closed, purged }, { headers: { "Cache-Control": "no-store" } });
}
