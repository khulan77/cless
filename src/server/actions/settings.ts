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
