/**
 * Контент хуудсууд (/about, /privacy, /contact)-ын SiteSetting schema ба placeholder агуулга.
 * Placeholder нь админд тохиргоо хадгалагдаагүй үед формын эхлэх утга, сайтад fallback болно.
 */
import { z } from "zod";
import type { AboutPageSetting, ContactPageSetting, PrivacyPageSetting } from "@/lib/site-settings";
import { imageUrlSchema, requiredText } from "./common";

const image = z.object({ src: imageUrlSchema, alt: z.string().trim().max(200) });

export const aboutPageSchema = z.object({
  title: requiredText(80),
  intro: requiredText(1000),
  sections: z
    .array(z.object({ title: requiredText(80), text: requiredText(3000), image }))
    .min(2, "2–3 хэсэг байна.")
    .max(3, "2–3 хэсэг байна."),
}) satisfies z.ZodType<AboutPageSetting>;

export const privacyPageSchema = z.object({
  title: requiredText(80),
  body: requiredText(30_000),
}) satisfies z.ZodType<PrivacyPageSetting>;

const MAPS_HOSTS = new Set(["www.google.com", "google.com", "maps.google.com"]);

/** Google Maps → Share → Embed a map: iframe код эсвэл src хаяг. Хоосон = газрын зураггүй. */
export function normalizeMapEmbed(raw: string): string {
  const v = raw.trim();
  const src = v.match(/src\s*=\s*["']([^"']+)["']/i)?.[1] ?? v;
  return src.replace(/&amp;/g, "&");
}

export function isMapEmbedUrl(v: string): boolean {
  if (v === "") return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && MAPS_HOSTS.has(u.hostname) && u.pathname.startsWith("/maps/embed");
  } catch {
    return false;
  }
}

export const contactPageSchema = z.object({
  mapEmbedUrl: z
    .string()
    .max(2000)
    .transform(normalizeMapEmbed)
    .refine(isMapEmbedUrl, "Google Maps-ийн «Embed a map» кодыг хуулж оруулна уу (https://www.google.com/maps/embed?…)."),
}) satisfies z.ZodType<ContactPageSetting, { mapEmbedUrl: string }>;

// ─────────────── Placeholder (клиент өөрөө солино) ───────────────

export const ABOUT_PAGE_DEFAULT: AboutPageSetting = {
  title: "Бидний тухай",
  intro:
    "CLÉSS бол Францын Biologique Recherche брэндийн Монгол дахь албан ёсны СПА салон юм. Бид арьс бүрийн онцлогт тохирсон мэргэжлийн арчилгаа, бүтээгдэхүүнийг санал болгодог.",
  sections: [
    {
      title: "Арьсанд суурилсан арга барил",
      text: "Арчилгаа бүр арьсны оношлогоогоор эхэлдэг. Таны арьсны тухайн өдрийн төлөвт тохируулан протокол, бүтээгдэхүүнийг сонгоно.",
      image: { src: "/placeholders/banner-1.svg", alt: "Арьсны оношлогоо" },
    },
    {
      title: "Мэргэшсэн баг",
      text: "Манай гоо засалчид Biologique Recherche-ийн арга зүйгээр бэлтгэгдсэн бөгөөд тогтмол сургалтад хамрагддаг.",
      image: { src: "/placeholders/banner-2.svg", alt: "Салоны баг" },
    },
    {
      title: "Салонд зочлоорой",
      text: "Цаг захиалах, бүтээгдэхүүний зөвлөгөө авахыг хүсвэл бидэнтэй холбогдоорой.",
      image: { src: "/placeholders/banner-3.svg", alt: "Салоны дотор тал" },
    },
  ],
};

export const PRIVACY_PAGE_DEFAULT: PrivacyPageSetting = {
  title: "Нууцлалын бодлого",
  body: `Энэхүү хуудсанд CLÉSS (цаашид «бид») таны хувийн мэдээллийг хэрхэн цуглуулж, ашиглаж, хадгалдаг талаар ерөнхий байдлаар тайлбарлана.

## Бид ямар мэдээлэл цуглуулдаг вэ

- Нэр, утасны дугаар, имэйл хаяг — цаг захиалах, худалдан авалт хийх үед
- Арьсны төрөл, арчилгааны түүх — үйлчилгээг тань тохируулахын тулд
- Худалдан авалтын түүх

## Мэдээллийг юунд ашигладаг вэ

- Цаг захиалга, үйлчилгээ, худалдан авалтыг гүйцэтгэх
- Арчилгааны зөвлөмж, баримт илгээх
- Таны зөвшөөрснөөр шинэ бүтээгдэхүүн, урамшууллын мэдээ илгээх

## Мэдээллийн хамгаалалт

Таны мэдээллийг зөвхөн эрх бүхий ажилтнууд үзэх боломжтой бөгөөд гуравдагч этгээдэд худалдахгүй.

## Холбоо барих

Өөрийн мэдээллийг харах, засах, устгуулах хүсэлтээ [холбоо барих](/contact) хуудсанд байгаа хаягаар илгээнэ үү.`,
};

export const CONTACT_PAGE_DEFAULT: ContactPageSetting = { mapEmbedUrl: "" };
