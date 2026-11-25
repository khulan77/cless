/** WeSend webhook гарын үсэг — цэвэр функц: "t=<unix>,v1=<hex>", v1 = HMAC-SHA256(secret, `${t}.${rawBody}`), ±5 мин */
import { createHmac, timingSafeEqual } from "node:crypto";

export const TOLERANCE_SEC = 300;

export function verifySignature(rawBody: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;
  if (Math.abs(nowSec - t) > TOLERANCE_SEC) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const got = Buffer.from(v1, "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

