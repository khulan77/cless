/**
 * Санхүүгийн тохиргоо (SiteSetting "finance") — ADMIN / ACCOUNTANT засна:
 *  - managerExpenses / managerFinance: MANAGER зардал / санхүүгийн тайланг ХАРАХ эсэх (анхдагч — үгүй; нягтлан шийднэ)
 *  - managerPayroll: MANAGER цалингийн тайланг (үе, мөр) ХАРАХ эсэх (PROMPT 19, анхдагч — үгүй)
 *  - opening: мөнгөн гүйлгээний эхний үлдэгдэл (огноо, бэлэн, данс) — үүнээс хойших гүйлгээгээр үлдэгдэл тооцно
 * TODO(нягтлан): НХАТ (хотын албан татвар) хамаарах эсэх — хамаарвал энд хувь нэмж НӨАТ-ын тайланд мөр гаргана.
 */
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

type Client = Prisma.TransactionClient | typeof db;
const KEY = "finance";
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.coerce.number().int().min(-10_000_000_000).max(10_000_000_000);

export const financeSettingsSchema = z.object({
  managerExpenses: z.boolean().catch(false).default(false),
  managerFinance: z.boolean().catch(false).default(false),
  managerPayroll: z.boolean().catch(false).default(false),
  opening: z
    .object({ asOf: dateKey, cash: money, bank: money })
    .nullable()
    .catch(null)
    .default(null),
});
export type FinanceSettings = z.infer<typeof financeSettingsSchema>;

export async function getFinanceSettings(client: Client = db): Promise<FinanceSettings> {
  const row = await client.siteSetting.findUnique({ where: { key: KEY }, select: { value: true } });
  return financeSettingsSchema.parse(row?.value ?? {});
}

export const saveFinanceSettingsSchema = z.object({
  managerExpenses: z.boolean(),
  managerFinance: z.boolean(),
  managerPayroll: z.boolean().default(false),
  opening: z.object({ asOf: dateKey, cash: money, bank: money }).nullable(),
});

export async function saveFinanceSettings(raw: z.input<typeof saveFinanceSettingsSchema>, actorId: string) {
  const value = saveFinanceSettingsSchema.parse(raw);
  await db.$transaction(async (tx) => {
    const before = await tx.siteSetting.findUnique({ where: { key: KEY } });
    await tx.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
    await audit(tx, { userId: actorId, action: "finance.settings", entity: "SiteSetting", entityId: KEY, before: before?.value, after: value });
  });
  return value;
}
