/** Тохиргоо → Мэдэгдэл: айлчлал дуусахад тайланг автоматаар илгээх (анхдагч: унтраатай) */
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

const KEY = "notify";
export const notifySettingsSchema = z.object({ autoVisitEmail: z.boolean().catch(false).default(false) });
export type NotifySettings = z.infer<typeof notifySettingsSchema>;

export async function getNotifySettings(client: Prisma.TransactionClient | typeof db = db): Promise<NotifySettings> {
  const row = await client.siteSetting.findUnique({ where: { key: KEY }, select: { value: true } });
  return notifySettingsSchema.parse(row?.value ?? {});
}

export async function saveNotifySettings(value: NotifySettings, actorId: string) {
  const v = notifySettingsSchema.parse(value);
  await db.$transaction(async (tx) => {
    await tx.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: v }, update: { value: v } });
    await audit(tx, { userId: actorId, action: "settings.notify", entity: "SiteSetting", entityId: KEY, after: v });
  });
}
