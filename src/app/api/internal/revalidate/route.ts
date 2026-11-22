/**
 * Дотоод: worker → Next storefront-ийн кэш хүчингүй болгох.
 * Зөвхөн shared secret-тэй, дотоод сүлжээнээс ирсэн хүсэлт. Next өөрөө X-Forwarded-For-д socket-ийн
 * хаягийг нэмдэг тул "XFF байхгүй" гэж шалгах боломжгүй — оронд нь XFF-ийн БҮХ хаяг loopback/хувийн
 * сүлжээ байх ёстой. Caddy гаднаас ирсэн хүсэлтэд жинхэнэ (нийтийн) IP-г нэмдэг тул хуурамч
 * "127.0.0.1" илгээсэн ч татгалзагдана.
 */
import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { INTERNAL_SECRET_HEADER, STOREFRONT_TAGS, isInternalAddress } from "@/server/modules/cache/storefront";
import { log } from "@/server/log";

function fromInternalNetwork(req: NextRequest): boolean {
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return true;
  return xff.split(",").every((part) => isInternalAddress(part));
}

function secretOk(given: string | null): boolean {
  const secret = process.env.INTERNAL_REVALIDATE_SECRET;
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // Гаднаас (proxy-оор) ирсэн хүсэлт — secret таарсан ч хүлээж авахгүй
  if (!fromInternalNetwork(req) || !secretOk(req.headers.get(INTERNAL_SECRET_HEADER))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { tags?: unknown; reason?: unknown };
  const allowed = new Set<string>(STOREFRONT_TAGS);
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string" && allowed.has(t)) : [];
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  log.info("storefront revalidated", { tags, reason: typeof body.reason === "string" ? body.reason.slice(0, 80) : undefined });
  return NextResponse.json({ ok: true, tags });
}
