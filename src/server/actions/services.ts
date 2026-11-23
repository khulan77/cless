"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requireAnyPermission, requirePermission } from "@/server/auth/session";
import { UserError } from "@/server/errors";
import { storage } from "@/server/storage";
import { serviceInputSchema, type ServiceInput } from "@/lib/validation/service";
import { parseInput, runAction } from "./result";

export async function saveService(input: ServiceInput) {
  return runAction(async () => {
    const user = await requirePermission("service:write");
    const data = parseInput(serviceInputSchema, input);
    let removedImage: string | null = null;

    const id = await db.$transaction(
      async (tx) => {
        const before = data.id
          ? await tx.service.findUnique({ where: { id: data.id }, include: { consumables: true } })
          : null;
        if (data.id && !before) throw new UserError("Үйлчилгээ олдсонгүй.");
        const slugOwner = await tx.service.findUnique({ where: { slug: data.slug }, select: { id: true } });
        if (slugOwner && slugOwner.id !== data.id) {
          throw new UserError("Энэ slug өөр үйлчилгээнд ашиглагдсан байна.", { slug: ["Slug давхардсан."] });
        }

        const fields = {
          name: data.name,
          slug: data.slug,
          description: data.description,
          durationMin: data.durationMin,
          bufferMin: data.bufferMin,
          requiresRoom: data.requiresRoom,
          bookable: data.bookable,
          isPublic: data.isPublic,
          category: data.category,
          shortDescription: data.shortDescription,
          suitableFor: data.suitableFor,
          results: data.results,
          priceFrom: data.priceFrom,
          price: data.price,
          costNote: data.costNote,
          image: data.image,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        };
        const service = before
          ? await tx.service.update({ where: { id: before.id }, data: fields })
          : await tx.service.create({ data: fields });
        if (before?.image && before.image !== data.image) removedImage = before.image;

        const variantIds = data.consumables.map((c) => c.variantId);
        const found = await tx.variant.count({ where: { id: { in: variantIds } } });
        if (found !== variantIds.length) throw new UserError("Сонгосон бүтээгдэхүүний зарим нь олдсонгүй.");

        await tx.serviceConsumable.deleteMany({ where: { serviceId: service.id, variantId: { notIn: variantIds } } });
        for (const c of data.consumables) {
          await tx.serviceConsumable.upsert({
            where: { serviceId_variantId: { serviceId: service.id, variantId: c.variantId } },
            create: { serviceId: service.id, variantId: c.variantId, qtyPerService: c.qtyPerService },
            update: { qtyPerService: c.qtyPerService },
          });
        }

        await audit(tx, {
          userId: user.id,
          action: before ? "service.update" : "service.create",
          entity: "Service",
          entityId: service.id,
          before: before && {
            ...before,
            consumables: before.consumables.map(({ variantId, qtyPerService }) => ({ variantId, qtyPerService })),
          },
          after: { ...fields, consumables: data.consumables },
        });
        return service.id;
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    if (removedImage) await storage.remove(removedImage);
    updateTag("catalog");
    revalidatePath("/");
    return { id };
  }, "Үйлчилгээ хадгалагдлаа.");
}

export type VariantOption = { id: string; label: string; sku: string };

/** Орц / багцын бүрэлдэхүүн сонгоход: нэр / SKU-ээр хайна */
export async function searchVariants(query: string) {
  return runAction(async () => {
    await requireAnyPermission("service:write", "product:write");
    const q = z.string().trim().max(100).parse(query);
    const rows = await db.variant.findMany({
      where: {
        isActive: true,
        ...(q && {
          OR: [
            { sku: { contains: q, mode: "insensitive" } },
            { product: { name: { contains: q, mode: "insensitive" } } },
          ],
        }),
      },
      orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }],
      take: 15,
      select: { id: true, sku: true, size: true, product: { select: { name: true } } },
    });
    return rows.map((v) => ({ id: v.id, hint: v.sku, label: `${v.product.name} · ${v.size}` }));
  });
}
