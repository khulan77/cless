/**
 * "Удахгүй нээгдэнэ" горим (PROMPT 24) — proxy болон хуудсууд хуваалцана (Node runtime).
 *  - SITE_MODE=coming_soon → нийтийн хуудсыг /coming-soon руу rewrite (503 + Retry-After), noindex.
 *  - ?preview=<SITE_PREVIEW_SECRET> → httpOnly cookie (14 хоног) — жинхэнэ сайт; ?preview=off → устгана.
 *    Cookie-д secret-ийг өөрийг нь биш, HMAC-ийг хадгална (cookie алдагдсан ч secret задрахгүй, secret солиход хүчингүй).
 *  - Нэвтэрсэн ADMIN / MANAGER / ACCOUNTANT — жинхэнэ сайт.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const PREVIEW_COOKIE = "cless_preview";
export const PREVIEW_MAX_AGE = 14 * 86_400;
export const RETRY_AFTER = "86400";

export const isComingSoon = () => (process.env.SITE_MODE ?? "").trim().toLowerCase() === "coming_soon";

const secret = () => process.env.SITE_PREVIEW_SECRET ?? "";

/** Cookie-ийн утга: HMAC(secret) — secret 16+ тэмдэгт биш бол preview идэвхгүй */
export function previewToken(): string | null {
  const s = secret();
  if (s.length < 16) return null;
  return createHmac("sha256", s).update("cless-preview-v1").digest("base64url");
}

const eq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** ?preview=<secret> зөв эсэх (timing-safe) */
export function previewSecretMatches(given: string): boolean {
  const s = secret();
  return s.length >= 16 && eq(given, s);
}

export function previewCookieValid(value: string | undefined): boolean {
  const t = previewToken();
  return !!t && !!value && eq(value, t);
}

export const STAFF_PREVIEW_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"] as const;

/** Rewrite хийхгүй замууд: админ, API, coming-soon өөрөө, Next дотоод, статик файл */
export function isExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/") ||
    pathname === "/coming-soon" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/_vercel") ||
    /\.[a-z0-9]{2,5}$/i.test(pathname) // favicon.ico, /brand/*.png, /uploads/*, robots.txt тусдаа
  );
}

export const COMING_SOON_ROBOTS = "User-agent: *\nDisallow: /\n";
export const EMPTY_SITEMAP = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
