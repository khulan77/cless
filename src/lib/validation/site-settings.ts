import { z } from "zod";
import type { SiteSettings } from "@/lib/site-settings";
import { hrefSchema, imageUrlSchema, requiredText, slugSchema } from "./common";

const image = z.object({ src: imageUrlSchema, alt: z.string().trim().max(200) });
const link = z.object({ label: requiredText(60), href: hrefSchema });

export const BENEFIT_ICONS = {
  gift: "Бэлэг",
  package: "Хайрцаг",
  "scan-face": "Оношлогоо",
  "shield-check": "Аюулгүй",
  sparkles: "Гялбаа",
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
          icon: z.enum(["gift", "package", "scan-face", "shield-check", "sparkles"]),
          lines: z.tuple([requiredText(40), requiredText(40)]),
        }),
      )
      .length(4, "Яг 4 мөр байна."),
  }),
} satisfies { [K in keyof SiteSettings]?: z.ZodType<SiteSettings[K]> };

export type EditableSettingKey = keyof typeof settingSchemas;
export const EDITABLE_SETTING_KEYS = Object.keys(settingSchemas) as EditableSettingKey[];
