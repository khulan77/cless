import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import {
  COMING_SOON_ROBOTS,
  EMPTY_SITEMAP,
  PREVIEW_COOKIE,
  PREVIEW_MAX_AGE,
  RETRY_AFTER,
  STAFF_PREVIEW_ROLES,
  isComingSoon,
  isExempt,
  previewCookieValid,
  previewSecretMatches,
  previewToken,
} from "@/lib/site-mode";

// Next 16: `middleware.ts` → `proxy.ts`. /admin — зөвхөн session байгаа эсэхийг шалгана (эрхийг server тал DB-ээс).
// PROMPT 24: SITE_MODE=coming_soon үед нийтийн хуудсыг "Удахгүй нээгдэнэ" (503) болгоно (src/lib/site-mode.ts).
// Auth.js-ийг зөвхөн /admin болон ажилтны session cookie-тэй үед дуудна — зочдод auth cookie тавихгүй.
const { auth } = NextAuth(authConfig);

type Mw = (req: NextRequest, ev: NextFetchEvent) => Promise<Response | undefined> | Response | undefined;

const NOINDEX: Record<string, string> = { "X-Robots-Tag": "noindex, nofollow" };
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

const adminProxy = auth as unknown as Mw;

function passWithNoindex() {
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(NOINDEX)) res.headers.set(k, v);
  return res;
}

// /coming-soon-ийн HTML-ийг 60 сек кэшилж 503-аар буцаана (rewrite нь статусыг дамжуулдаггүй)
let cached: { html: string; at: number } | null = null;
async function comingSoon(req: NextRequest): Promise<Response> {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Retry-After": RETRY_AFTER, "Cache-Control": "no-store", ...NOINDEX };
  try {
    if (!cached || Date.now() - cached.at > 60_000) {
      const r = await fetch(new URL("/coming-soon", req.url), { headers: { "x-cless-internal": "coming-soon" }, cache: "no-store" });
      if (r.ok) cached = { html: await r.text(), at: Date.now() };
    }
    if (cached) return new NextResponse(cached.html, { status: 503, headers });
  } catch {
    // доор rewrite
  }
  return NextResponse.rewrite(new URL("/coming-soon", req.url), { headers: { "Retry-After": RETRY_AFTER, ...NOINDEX } });
}

/** Нэвтэрсэн ADMIN / MANAGER / ACCOUNTANT — жинхэнэ сайт */
const staffCheck = auth((req) => {
  const role = (req.auth?.user as { role?: string } | undefined)?.role;
  if (role && (STAFF_PREVIEW_ROLES as readonly string[]).includes(role)) return passWithNoindex();
  return comingSoon(req);
}) as unknown as Mw;

export async function proxy(req: NextRequest, ev: NextFetchEvent) {
  const { pathname, searchParams } = req.nextUrl;
  if (pathname.startsWith("/admin")) return adminProxy(req, ev);

  if (!isComingSoon()) {
    if (pathname === "/coming-soon") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (pathname === "/robots.txt") return new NextResponse(COMING_SOON_ROBOTS, { headers: { "Content-Type": "text/plain; charset=utf-8", ...NOINDEX } });
  if (pathname === "/sitemap.xml") return new NextResponse(EMPTY_SITEMAP, { headers: { "Content-Type": "application/xml; charset=utf-8", ...NOINDEX } });

  // ?preview=<secret> → cookie; ?preview=off → устгана. Параметргүй URL руу буцаана.
  const preview = searchParams.get("preview");
  if (preview !== null) {
    const clean = new URL(req.url);
    clean.searchParams.delete("preview");
    const res = NextResponse.redirect(clean);
    if (preview === "off") res.cookies.delete(PREVIEW_COOKIE);
    else if (previewSecretMatches(preview)) {
      res.cookies.set(PREVIEW_COOKIE, previewToken()!, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: PREVIEW_MAX_AGE });
    }
    return res;
  }

  if (isExempt(pathname)) return NextResponse.next();
  if (previewCookieValid(req.cookies.get(PREVIEW_COOKIE)?.value)) return passWithNoindex();
  if (SESSION_COOKIES.some((c) => req.cookies.has(c))) return staffCheck(req, ev);
  return comingSoon(req);
}

export const config = {
  // Бүх хуудас + robots/sitemap; Next-ийн дотоод, статик файл (өргөтгөлтэй) — алгасна
  matcher: ["/((?!_next/|_vercel|.*\\.[a-zA-Z0-9]{2,5}$).*)", "/robots.txt", "/sitemap.xml"],
};
