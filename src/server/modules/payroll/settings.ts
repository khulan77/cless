/**
 * Цалингийн ерөнхий тохиргоо (SiteSetting "payroll"):
 *  - mode: ADVANCE_FINAL (анхдагч — 1–15 урьдчилгаа, сарын эцэст бүтэн сараар суутгал) | INDEPENDENT (хагас бүр бие даан)
 *  - splitDay: эхний үеийн сүүлийн өдөр (анхдагч 15)
 *  - advanceWithholding: урьдчилгаанаас НДШ/ХХОАТ суутгах эсэх (анхдагч — үгүй)
 *  - commissionBase: урамшууллыг НӨАТ-тэй дүнгээс (GROSS, анхдагч — өмнөх тооцоотой ижил) эсвэл НӨАТ-гүй цэвэр
 *    дүнгээс (NET) бодох. TODO(нягтлан): баталгаажуулна (PROMPT 18 §3) — батлахаас өмнө урамшуулал чимээгүй буурахгүй.
 */
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

type Client = Prisma.TransactionClient | typeof db;
const KEY = "payroll";

export const payrollSettingsSchema = z.object({
  mode: z.enum(["ADVANCE_FINAL", "INDEPENDENT"]).catch("ADVANCE_FINAL").default("ADVANCE_FINAL"),
  splitDay: z.coerce.number().int().min(5).max(25).catch(15).default(15),
  advanceWithholding: z.coerce.boolean().catch(false).default(false),
  commissionBase: z.enum(["NET", "GROSS"]).catch("GROSS").default("GROSS"),
});
export type PayrollSettings = z.infer<typeof payrollSettingsSchema>;

export async function getPayrollSettings(client: Client = db): Promise<PayrollSettings> {
  const row = await client.siteSetting.findUnique({ where: { key: KEY }, select: { value: true } });
  return payrollSettingsSchema.parse(row?.value ?? {});
}

export const savePayrollSettingsSchema = z.object({
  mode: z.enum(["ADVANCE_FINAL", "INDEPENDENT"]),
  splitDay: z.coerce.number().int().min(5, "5–25 хооронд").max(25, "5–25 хооронд"),
  advanceWithholding: z.boolean(),
  commissionBase: z.enum(["NET", "GROSS"]).default("GROSS"),
});

export async function savePayrollSettings(raw: z.input<typeof savePayrollSettingsSchema>, actorId: string) {
  const value = savePayrollSettingsSchema.parse(raw);
  await db.$transaction(async (tx) => {
    const before = await tx.siteSetting.findUnique({ where: { key: KEY } });
    await tx.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
    await audit(tx, { userId: actorId, action: "payroll.settings", entity: "SiteSetting", entityId: KEY, before: before?.value, after: value });
  });
  return value;
}
