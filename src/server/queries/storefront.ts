import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { FooterSetting } from "@/lib/site-settings";
import { hoursToLines, type WeekHours } from "@/lib/hours";
import { db } from "@/server/db";
import { bookingSettingsSchema, shopSettingsSchema, type ShopMode } from "@/server/modules/settings/schema";

export type SalonInfo = {
  shopMode: ShopMode;
  siteName: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  mapsUrl: string | null;
  instagram: string | null;
  facebook: string | null;
  /** facebook.com/<page> → m.me/<page> */
  messenger: string | null;
  hours: WeekHours;
  /** "Даваа–Бямба 10:00–20:00", "Ням амарна" — салбарын ажлын цагаас */
  hoursLines: string[];
};

/** Seed / жишээ утга (example.mn, +976 0000 0000) сайтад хэзээ ч гарахгүй */
export function realValue(v: string | null | undefined): string {
  const x = (v ?? "").trim();
  if (!x || /example\.(mn|com)/i.test(x) || /0000\s*0000/.test(x)) return "";
  return x;
}

/** https://instagram.com/<handle> — зөвхөн хуудас заасан холбоос (хоосон "https://instagram.com/" биш) */
function profileUrl(v: string | null | undefined): string | null {
  const x = realValue(v);
  if (!x) return null;
  try {
    return new URL(x).pathname.split("/").filter(Boolean).length > 0 ? x : null;
  } catch {
    return null;
  }
}

/** facebook.com/<page> → https://m.me/<page> (хуудасны нэр танигдахгүй бол null) */
export function messengerUrl(facebook: string | null | undefined): string | null {
  if (!facebook) return null;
  try {
    const u = new URL(facebook);
    if (!/(^|\.)facebook\.com$|(^|\.)fb\.com$/.test(u.hostname)) return null;
    const page = u.pathname.split("/").filter(Boolean)[0];
    if (!page || ["profile.php", "pages", "people"].includes(page)) return null;
    return `https://m.me/${page}`;
  } catch {
    return null;
  }
}

/**
 * Сайтын бүх газарт (header CTA, footer, салоны хуудас, sheet, JSON-LD) хэрэглэх салоны мэдээлэл —
 * нэг эх сурвалж: Тохиргоо (Branch + footer.contact/socials), Ажлын хуваарь (салбарын цаг), Брэнд.
 * Админ хадгалахад updateTag("settings").
 */
export async function getSalonInfo(): Promise<SalonInfo> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 86400, expire: 604800 });
  cacheTag("settings");

  const [branch, rows] = await Promise.all([
    db.branch.findFirst({ where: { code: "CL" }, select: { name: true, address: true, phone: true } }),
    db.siteSetting.findMany({ where: { key: { in: ["shop", "footer", "brand", "booking"] } }, select: { key: true, value: true } }),
  ]);
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const footer = get("footer") as FooterSetting | undefined;
  const brand = get("brand") as { siteName?: string } | undefined;
  const booking = bookingSettingsSchema.parse(get("booking") ?? {});
  const social = (n: "instagram" | "facebook") => profileUrl(footer?.socials?.find((s) => s.network === n)?.href);
  const facebook = social("facebook");
  return {
    shopMode: shopSettingsSchema.parse(get("shop") ?? {}).mode,
    siteName: brand?.siteName || branch?.name || "",
    name: branch?.name ?? "",
    phone: realValue(footer?.contact?.phone) || realValue(branch?.phone),
    email: realValue(footer?.contact?.email),
    address: realValue(footer?.contact?.address) || realValue(branch?.address),
    mapsUrl: realValue(footer?.contact?.mapsUrl) || null,
    instagram: social("instagram"),
    facebook,
    messenger: messengerUrl(facebook),
    hours: booking.hours,
    hoursLines: hoursToLines(booking.hours),
  };
}
