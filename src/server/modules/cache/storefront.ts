/**
 * Storefront-ийн кэш (үлдэгдэл, үнэ, бүтээгдэхүүн). Бүх каталогийн query "catalog" tag-тай.
 *
 *  - Next процесс дотор (server action): updateTag("catalog") — шууд (read-your-own-writes).
 *  - Route handler дотор: revalidateTag("catalog", { expire: 0 }) — дараагийн хүсэлт шинэ өгөгдөл авна.
 *  - Worker (тусдаа процесс, Next-ийн кэшид хүрэхгүй): дотоод route руу HTTP дуудлага —
 *    requestStorefrontRevalidate(). Амжилтгүй бол лог бичээд үргэлжилнэ (кэш хамгийн ихдээ 5 минутад шинэчлэгдэнэ).
 */
import { log } from "@/server/log";

export const STOREFRONT_TAGS = ["catalog"] as const;
export const INTERNAL_SECRET_HEADER = "x-internal-secret";

export function internalRevalidateUrl() {
  const base = (process.env.APP_INTERNAL_URL || "http://127.0.0.1:20267").replace(/\/+$/, "");
  return `${base}/api/internal/revalidate`;
}

/** 127.0.0.0/8, ::1, 10/8, 172.16/12, 192.168/16, fc00::/7 (IPv4-mapped хэлбэр ч) */
export function isInternalAddress(raw: string): boolean {
  const ip = raw.trim().replace(/^::ffff:/i, "").replace(/^\[|\]$/g, "");
  if (ip === "::1" || /^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip)) return true;
  const m = /^172\.(\d+)\./.exec(ip);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return /^f[cd][0-9a-f]{2}:/i.test(ip);
}

/** Worker-оос: Next апп-д storefront-ийн кэшийг хүчингүй болгохыг хүснэ */
export async function requestStorefrontRevalidate(reason: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const secret = process.env.INTERNAL_REVALIDATE_SECRET;
  if (!secret) {
    log.warn("storefront revalidate skipped: INTERNAL_REVALIDATE_SECRET not set", { reason });
    return false;
  }
  try {
    const res = await fetchImpl(internalRevalidateUrl(), {
      method: "POST",
      headers: { "content-type": "application/json", [INTERNAL_SECRET_HEADER]: secret },
      body: JSON.stringify({ tags: STOREFRONT_TAGS, reason }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      log.warn("storefront revalidate failed", { reason, status: res.status });
      return false;
    }
    return true;
  } catch (e) {
    log.warn("storefront revalidate failed", { reason, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}
