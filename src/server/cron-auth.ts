/**
 * Vercel Cron: `Authorization: Bearer <CRON_SECRET>` толгойтой GET илгээнэ.
 * CRON_SECRET тохируулаагүй бол хэзээ ч зөвшөөрөхгүй. Тогтмол хугацааны харьцуулалт.
 */
import { timingSafeEqual } from "node:crypto";

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
