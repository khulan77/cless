"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requirePermission } from "@/server/auth/session";
import { UserError } from "@/server/errors";
import { EDITABLE_SETTING_KEYS, settingSchemas, type EditableSettingKey } from "@/lib/validation/site-settings";
import { parseInput, runAction } from "./result";
import {
  saveEmailSettings,
  savePosSettings,
  saveQPayMode,
  saveSalonSettings,
  saveShopMode,
  type SalonInput,
} from "@/server/modules/settings/admin-settings";

export async function saveSetting(input: { key: EditableSettingKey; value: unknown }) {
  return runAction(async () => {
    const user = await requirePermission("settings:write");
    const key = z.enum(EDITABLE_SETTING_KEYS as [EditableSettingKey, ...EditableSettingKey[]]).parse(input.key);
    const value = parseInput(settingSchemas[key], input.value);

    if (key === "featuredProduct") {
      const slug = (value as { productSlug: string }).productSlug;
      const product = await db.product.findUnique({ where: { slug }, select: { isPublished: true } });
      if (!product) throw new UserError("Сонгосон бүтээгдэхүүн олдсонгүй.", { productSlug: ["Бүтээгдэхүүн олдсонгүй."] });
      if (!product.isPublished) throw new UserError("Нийтлэгдээгүй бүтээгдэхүүнийг онцлох боломжгүй.");
    }

    await db.$transaction(async (tx) => {
      const before = await tx.siteSetting.findUnique({ where: { key } });
      const json = value as Prisma.InputJsonValue;
      await tx.siteSetting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
      await audit(tx, { userId: user.id, action: "setting.update", entity: "SiteSetting", entityId: key, before: before?.value, after: value });
    });

    updateTag("settings");
    revalidatePath("/");
  }, "Сайтын контент хадгалагдлаа.");
}

// ─────────────── ADMIN → Тохиргоо ───────────────

export async function saveSalonAction(input: SalonInput) {
  return runAction(async () => {
    const user = await requirePermission("settings:write");
    await saveSalonSettings(input, user.id);
    // Footer, холбоо барих хуудас, layout
    updateTag("settings");
    revalidatePath("/admin/settings");
  }, "Салоны мэдээлэл хадгалагдлаа.");
}

export async function saveShopModeAction(mode: "CATALOG" | "CHECKOUT") {
  return runAction(async () => {
    const user = await requirePermission("settings:write");
    await saveShopMode(mode, user.id);
    // Header, бүтээгдэхүүний хуудас, footer — бүгд горимоос хамаарна
    updateTag("settings");
    revalidatePath("/admin/settings");
  }, "Дэлгүүрийн горим хадгалагдлаа.");
}

export async function savePosSettingsAction(input: Parameters<typeof savePosSettings>[0]) {
  return runAction(async () => {
    const user = await requirePermission("settings:write");
    await savePosSettings(input, user.id);
    revalidatePath("/admin/settings");
  }, "POS тохиргоо хадгалагдлаа.");
}

export async function saveEmailSettingsAction(input: Parameters<typeof saveEmailSettings>[0]) {
  return runAction(async () => {
    const user = await requirePermission("settings:write");
    await saveEmailSettings(input, user.id);
    revalidatePath("/admin/settings");
  }, "Имэйлийн тохиргоо хадгалагдлаа.");
}

export async function saveQPayModeAction(mode: "manual" | "api") {
  return runAction(async () => {
    // Интеграцийн тохиргоо — зөвхөн ADMIN
    const user = await requirePermission("integration:write");
    await saveQPayMode(mode, user.id);
    revalidatePath("/admin/settings");
  }, "QPay горим хадгалагдлаа.");
}
