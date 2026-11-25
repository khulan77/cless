/**
 * Мэдэгдлийн загварууд (Тохиргоо → Мэдэгдэл): SiteSetting "notify-templates". Хоосон бол анхдагч.
 * Хувьсагч: {name} {service} {date} {time} {salon} {link} {reason} {staff}
 * SMS кирилл = unicode (1 хэсэг 65 тэмдэгт, дээд тал нь 4 хэсэг) — богино байлгана.
 */
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

export const TEMPLATE_KEYS = ["apptReceived", "apptConfirmed", "apptRejected", "apptReminder", "apptCancelled", "staffInvite", "visitReportIntro"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  apptReceived: "{salon}: {name}, {date} {time} {service} захиалгыг хүлээн авлаа. Ресепшн баталгаажуулмагц мэдэгдэнэ.",
  apptConfirmed: "{salon}: {name}, таны цаг баталгаажлаа: {date} {time}, {service}. Цуцлах: {link}",
  apptRejected: "{salon}: {name}, уучлаарай, {date} {time} захиалгыг баталгаажуулж чадсангүй. {reason} Өөр цаг: {link}",
  apptReminder: "{salon}: Сануулга — маргааш {date} {time} {service}. Цуцлах: {link}",
  apptCancelled: "{salon}: {date} {time} {service} цаг цуцлагдлаа. Шинэ цаг: {link}",
  staffInvite: "{salon}: {name}, таныг удирдлагын системд урьлаа. 72 цагийн дотор {link} хаягаар орж нууц үгээ үүсгэнэ үү.",
  visitReportIntro: "{salon}-д зочилсонд баярлалаа. Өнөөдрийн айлчлалын тойм, таны арьсны мэдээлэл, гэрийн арчилгааны зөвлөмжийг доор хүргэж байна.",
};

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  apptReceived: "SMS — онлайн захиалга хүлээн авсан",
  apptConfirmed: "SMS — цаг баталгаажсан",
  apptRejected: "SMS — захиалга татгалзсан",
  apptReminder: "SMS — 24 цагийн өмнөх сануулга",
  apptCancelled: "SMS — цаг цуцлагдсан",
  staffInvite: "SMS — ажилтны урилга",
  visitReportIntro: "Имэйл — айлчлалын тайлангийн оршил",
};

const KEY = "notify-templates";
const stored = z.record(z.string(), z.string()).catch({});

export async function getTemplates(client: Prisma.TransactionClient | typeof db = db): Promise<Record<TemplateKey, string>> {
  const row = await client.siteSetting.findUnique({ where: { key: KEY }, select: { value: true } });
  const s = stored.parse(row?.value ?? {});
  return Object.fromEntries(TEMPLATE_KEYS.map((k) => [k, s[k]?.trim() || DEFAULT_TEMPLATES[k]])) as Record<TemplateKey, string>;
}

export const templatesSchema = z.object(Object.fromEntries(TEMPLATE_KEYS.map((k) => [k, z.string().trim().max(600, "600 тэмдэгтээс ихгүй.")])) as Record<TemplateKey, z.ZodString>);

export async function saveTemplates(raw: Partial<Record<TemplateKey, string>>, actorId: string) {
  const v = templatesSchema.partial().parse(raw);
  // Анхдагчтай ижил бол хадгалахгүй (дараа анхдагч шинэчлэгдвэл дагана)
  const value = Object.fromEntries(Object.entries(v).filter(([k, t]) => t && t !== DEFAULT_TEMPLATES[k as TemplateKey]));
  await db.$transaction(async (tx) => {
    await tx.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
    await audit(tx, { userId: actorId, action: "settings.notify_templates", entity: "SiteSetting", entityId: KEY, after: { keys: Object.keys(value) } });
  });
}

export function renderTemplate(tpl: string, vars: Record<string, string | null | undefined>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "").replace(/\s{2,}/g, " ").trim();
}
