/** WeSend webhook — нэвтрэлтгүй, HMAC гарын үсгээр хамгаалагдсан (WESEND_WEBHOOK_SECRET). Түлхүүргүй бол 404. */
import { NextResponse } from "next/server";
import { recordEvent, verifySignature } from "@/server/modules/notifications/webhook";

export async function POST(req: Request) {
  const secret = process.env.WESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 404 });
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("wesend-signature"), secret)) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  let evt: { id?: string; type?: string; createdAt?: string; data?: unknown };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!evt.id || !evt.type) return NextResponse.json({ error: "bad event" }, { status: 400 });
  await recordEvent({ id: evt.id, type: evt.type, createdAt: evt.createdAt, data: evt.data });
  return NextResponse.json({ ok: true });
}
