/**
 * Тохиргоо → Онлайн захиалга (SiteSetting "online-booking").
 *  - enabled: асаах/унтраах (анхдагч — унтраатай)
 *  - mode: APPROVAL (ресепшн батална — анхдагч) | INSTANT (шууд баталгаажна)
 *  - minLeadHours / maxDaysAhead: хамгийн эрт/хожуу (анхдагч 2 цаг — 60 хоног)
 *  - cancelHours: үйлчлүүлэгч эхлэхээс N цагийн өмнө хүртэл цуцална (24)
 *  - allServices / serviceIds: онлайнаар захиалж болох үйлчилгээ
 *  - firstVisitServiceId: анхны үйлчлүүлэгчид заавал сонгуулах оношлогоо (Skin Instant©), null = шаардахгүй
 */
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

const KEY = "online-booking";

export const onlineBookingSchema = z.object({
  enabled: z.boolean().catch(false).default(false),
  mode: z.enum(["APPROVAL", "INSTANT"]).catch("APPROVAL").default("APPROVAL"),
  minLeadHours: z.number().int().min(0).max(168).catch(2).default(2),
  maxDaysAhead: z.number().int().min(1).max(365).catch(60).default(60),
  cancelHours: z.number().int().min(0).max(168).catch(24).default(24),
  allServices: z.boolean().catch(true).default(true),
  serviceIds: z.array(z.string()).catch([]).default([]),
  firstVisitServiceId: z.string().nullable().catch(null).default(null),
});
export type OnlineBookingSettings = z.infer<typeof onlineBookingSchema>;

export async function getOnlineBookingSettings(client: Prisma.TransactionClient | typeof db = db): Promise<OnlineBookingSettings> {
  const row = await client.siteSetting.findUnique({ where: { key: KEY }, select: { value: true } });
  return onlineBookingSchema.parse(row?.value ?? {});
}

export const saveOnlineBookingSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["APPROVAL", "INSTANT"]),
  minLeadHours: z.coerce.number().int().min(0, "0–168 цаг").max(168, "0–168 цаг"),
  maxDaysAhead: z.coerce.number().int().min(1, "1–365 хоног").max(365, "1–365 хоног"),
  cancelHours: z.coerce.number().int().min(0, "0–168 цаг").max(168, "0–168 цаг"),
  allServices: z.boolean(),
  serviceIds: z.array(z.string().min(1)).max(200),
  firstVisitServiceId: z.string().min(1).nullable(),
});

export async function saveOnlineBookingSettings(raw: z.input<typeof saveOnlineBookingSchema>, actorId: string) {
  const value = saveOnlineBookingSchema.parse(raw);
  await db.$transaction(async (tx) => {
    const before = await tx.siteSetting.findUnique({ where: { key: KEY } });
    await tx.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
    await audit(tx, { userId: actorId, action: "settings.online_booking", entity: "SiteSetting", entityId: KEY, before: before?.value, after: value });
  });
  return value;
}
