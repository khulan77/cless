import { z } from "zod";
import type { SiteSettings } from "@/lib/site-settings";
import { hrefSchema, imageUrlSchema, requiredText, slugSchema } from "./common";
import { aboutPageSchema, contactPageSchema, privacyPageSchema } from "./content-pages";

const image = z.object({ src: imageUrlSchema, alt: z.string().trim().max(200) });

/** Монгол болон олон улсын дугаар: "+976 7011 2233", "7011-2233", "99112233" */
export const phoneSchema = z
  .string({ error: "Утасны дугаар оруулна уу." })
  .trim()
  .regex(/^\+?\d[\d\s-]{5,18}\d$/, "Утасны дугаар буруу. Жишээ: +976 7011 2233")
  .refine((v) => v.replace(/\D/g, "").length >= 8, "Утасны дугаар хэт богино байна.");

export const SOCIAL_HOSTS = { instagram: "instagram.com", facebook: "facebook.com" } as const;

/** Хоосон эсвэл Google Maps-ийн https холбоос */
export const mapsUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" && /(^|\.)(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl)$/.test(u.hostname);
    } catch {
      return false;
    }
  }, "Google Maps-ийн https://… холбоос оруулна уу.")
  .optional()
  .transform((v) => v || undefined);

/** Хоосон (footer-т харагдахгүй) эсвэл тухайн сүлжээний https хаяг */
export function isSocialUrl(network: keyof typeof SOCIAL_HOSTS, value: string): boolean {
  if (value === "") return true;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^(www\.|m\.)/, "");
    return url.protocol === "https:" && host === SOCIAL_HOSTS[network];
  } catch {
    return false;
  }
}
const link = z.object({ label: requiredText(60), href: hrefSchema });

export const BENEFIT_ICONS = {
  gift: "Бэлэг",
  package: "Хайрцаг",
  "scan-face": "Оношлогоо",
  "shield-check": "Аюулгүй",
  sparkles: "Гялбаа",
  truck: "Хүргэлт",
} as const;

/** Админаас засагдах SiteSetting-ийн schema-ууд */
export const settingSchemas = {
  announcement: z.object({
    messages: z.array(requiredText(160)).min(1, "Дор хаяж нэг мөр.").max(6),
    intervalMs: z.number().int().min(2000, "2 секундээс багагүй.").max(30000),
  }),
  hero: z.object({
    image,
    title: z.array(requiredText(80)).min(1).max(3),
    cta: link,
    focal: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
    mobileImage: image.nullable().optional(),
    layout: z.enum(["cover", "center"]).optional(),
    background: z.string().regex(/^#[0-9a-f]{6}$/i, "#RRGGBB хэлбэрээр").optional(),
    headerTone: z.enum(["light", "dark"]).optional(),
  }),
  promoTrio: z.object({
    items: z
      .array(z.object({ image, title: requiredText(80), text: requiredText(300), cta: link }))
      .length(3, "Яг 3 карт байна."),
  }),
  splitPromo: z.object({
    eyebrow: requiredText(40),
    title: requiredText(80),
    text: requiredText(500),
    cta: link,
    image,
  }),
  featuredProduct: z.object({ title: requiredText(80), productSlug: slugSchema, image }),
  benefits: z.object({
    items: z
      .array(
        z.object({
          icon: z.enum(["gift", "package", "scan-face", "shield-check", "sparkles", "truck"]),
          lines: z.tuple([requiredText(40), requiredText(40)]),
        }),
      )
      .length(4, "Яг 4 мөр байна."),
  }),
  productBenefits: z.object({
    items: z
      .array(z.object({ icon: z.enum(["gift", "package", "scan-face", "shield-check", "sparkles", "truck"]), label: requiredText(60) }))
      .min(1, "Дор хаяж нэг мөр.")
      .max(4, "4-өөс ихгүй."),
  }),
  footer: z.object({
    // Формд засагдахгүй хэсгүүд — хадгалахад хэвээр дамжина, гэхдээ бүтцийг шалгана
    columns: z
      .array(
        z.object({
          title: requiredText(60),
          links: z.array(link).max(20),
          collections: z
            .object({
              kind: z.enum(["CATEGORY", "CONCERN"]),
              parentSlug: z.string().optional(),
              slugs: z.array(z.string()).optional(),
            })
            .optional(),
        }),
      )
      .max(6),
    // Холбоо барих / сошиал / ажлын цаг — Тохиргоо → Салоны мэдээлэл ба Ажлын хуваарьт
    // (өөрийн шалгалттай) засагдана. Энд зөвхөн бүтцийг дамжуулна.
    contact: z.object({
      title: requiredText(60),
      address: z.string().trim().max(300),
      phone: z.string().trim().max(40),
      email: z.string().trim().max(200),
      hours: z.array(z.string().trim().max(80)).max(7).default([]),
      /** Google Maps-ийн холбоос (заавал биш) */
      mapsUrl: mapsUrlSchema,
    }),
    socials: z
      .array(
        z.object({
          network: z.enum(["instagram", "facebook"]),
          href: z.string().trim(),
          label: requiredText(40),
        }),
      )
      .max(2)
      .superRefine((rows, ctx) => {
        rows.forEach((r, i) => {
          if (!isSocialUrl(r.network, r.href)) {
            ctx.addIssue({
              code: "custom",
              path: [i, "href"],
              message: `https://${SOCIAL_HOSTS[r.network]}/… хэлбэрийн хаяг оруулна уу.`,
            });
          }
        });
      }),
    newsletter: z.object({
      title: requiredText(60),
      text: requiredText(200),
      placeholder: requiredText(60),
      button: requiredText(30),
    }),
    copyright: requiredText(200),
  }),
  // Контент хуудсууд (src/lib/validation/content-pages.ts)
  aboutPage: aboutPageSchema,
  privacyPage: privacyPageSchema,
  contactPage: contactPageSchema,
} satisfies { [K in keyof SiteSettings]?: z.ZodType<SiteSettings[K]> };

export type EditableSettingKey = keyof typeof settingSchemas;
export const EDITABLE_SETTING_KEYS = Object.keys(settingSchemas) as EditableSettingKey[];
