"use server";

/**
 * Мэдэгдэл (PROMPT 15): айлчлалын тайланг имэйлээр илгээх, үйлчлүүлэгчийн имэйлийн зөвшөөрөл, онлайн захиалгыг нээх,
 * Тохиргоо → Мэдэгдэл / Онлайн захиалга.
 */
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/audit";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { queueVisitReport } from "@/server/modules/notifications/service";
import { saveNotifySettings } from "@/server/modules/notifications/settings";
import { saveTemplates, type TemplateKey } from "@/server/modules/notifications/templates";
import { saveOnlineBookingSchema, saveOnlineBookingSettings } from "@/server/modules/online-booking/settings";
import { parseInput, runAction } from "./result";

const SKIN = ["DRY", "OILY", "COMBINATION", "NORMAL", "SENSITIVE"] as const;

export async function sendVisitReportAction(input: { visitId: string; customerId: string; skinType: (typeof SKIN)[number] | null; summary: string | null }) {
  return runAction(async () => {
    const user = await requirePermission("visit:write");
    const v = parseInput(z.object({ visitId: z.string().min(1), customerId: z.string().min(1), skinType: z.enum(SKIN).nullable(), summary: z.string().trim().max(4000).nullable() }), input);
    await queueVisitReport({ visitId: v.visitId, actorId: user.id, edits: { skinType: v.skinType, summary: v.summary || null } });
    revalidatePath(`/admin/customers/${v.customerId}`);
  }, "Имэйл илгээх дараалалд орлоо.");
}

/** Ресепшн аман зөвшөөрлийг бүртгэнэ (огноотой, AuditLog) */
export async function setCustomerEmailConsentAction(customerId: string, consent: boolean) {
  return runAction(async () => {
    const user = await requirePermission("customer:write");
    await db.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: customerId }, data: { emailConsentAt: consent ? new Date() : null } });
      await audit(tx, { userId: user.id, action: "customer.email_consent", entity: "Customer", entityId: customerId, after: { consent } });
    });
    revalidatePath(`/admin/customers/${customerId}`);
  }, "Хадгалагдлаа.");
}

/** Ирээгүйн улмаас хаагдсан онлайн захиалгыг нээнэ (энэ мөчөөс хойших ирээгүйг л тоолно) */
export async function unblockOnlineBookingAction(customerId: string) {
  return runAction(async () => {
    const user = await requirePermission("customer:write");
    await db.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: customerId }, data: { onlineUnblockedAt: new Date() } });
      await audit(tx, { userId: user.id, action: "customer.online_unblock", entity: "Customer", entityId: customerId });
    });
    revalidatePath(`/admin/customers/${customerId}`);
  }, "Онлайн захиалга нээгдлээ.");
}

export async function saveOnlineBookingAction(input: z.input<typeof saveOnlineBookingSchema>) {
  return runAction(async () => {
    const user = await requirePermission("settings:write");
    parseInput(saveOnlineBookingSchema, input);
    await saveOnlineBookingSettings(input, user.id);
    // Сайтын "Цаг захиалах" товч (getSalonInfo кэш)
    updateTag("settings");
    revalidatePath("/admin/settings/online-booking");
  }, "Хадгалагдлаа.");
}

export async function saveNotifySettingsAction(input: { autoVisitEmail: boolean }) {
  return runAction(async () => {
    const user = await requirePermission("settings:write");
    await saveNotifySettings(parseInput(z.object({ autoVisitEmail: z.boolean() }), input), user.id);
    revalidatePath("/admin/settings/notifications");
  }, "Хадгалагдлаа.");
}

export async function saveTemplatesAction(input: Partial<Record<TemplateKey, string>>) {
  return runAction(async () => {
    const user = await requirePermission("settings:write");
    await saveTemplates(input, user.id);
    revalidatePath("/admin/settings/notifications");
  }, "Загварууд хадгалагдлаа.");
}
