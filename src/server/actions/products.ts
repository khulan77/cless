"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { can } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { ForbiddenError, UserError } from "@/server/errors";
import { storage } from "@/server/storage";
import { productInputSchema, type ProductInput } from "@/lib/validation/product";
import { parseInput, runAction } from "./result";

const TX_OPTS = { maxWait: 10_000, timeout: 30_000 } as const;

function refreshStorefront() {
  updateTag("catalog");
  revalidatePath("/");
}

export async function saveProduct(input: ProductInput) {
  return runAction(async () => {
    const user = await requirePermission("product:write");
    const data = parseInput(productInputSchema, input);

    const removedImageUrls: string[] = [];

    const id = await db.$transaction(async (tx) => {
      const before = data.id
        ? await tx.product.findUnique({
            where: { id: data.id },
            include: { variants: true, images: true, collections: true },
          })
        : null;
      if (data.id && !before) throw new UserError("Бүтээгдэхүүн олдсонгүй.");

      // Давхардлыг талбарын алдаагаар буцаана (DB unique нь сүүлчийн хамгаалалт)
      const slugOwner = await tx.product.findUnique({ where: { slug: data.slug }, select: { id: true } });
      if (slugOwner && slugOwner.id !== data.id) {
        throw new UserError("Энэ slug өөр бүтээгдэхүүнд ашиглагдсан байна.", { slug: ["Slug давхардсан."] });
      }
      const skuOwners = await tx.variant.findMany({
        where: { sku: { in: data.variants.map((v) => v.sku) } },
        select: { id: true, sku: true },
      });
      const skuErrors: Record<string, string[]> = {};
      data.variants.forEach((v, i) => {
        const owner = skuOwners.find((o) => o.sku === v.sku);
        if (owner && owner.id !== v.id) skuErrors[`variants.${i}.sku`] = ["Энэ SKU өөр хувилбарт ашиглагдсан."];
      });
      if (Object.keys(skuErrors).length) throw new UserError("SKU давхардсан байна.", skuErrors);

      const fields = {
        name: data.name,
        slug: data.slug,
        subtitle: data.subtitle,
        description: data.description,
        howToUse: data.howToUse,
        ingredients: data.ingredients,
        badge: data.badge,
        isPublished: data.isPublished,
        sortOrder: data.sortOrder,
      };
      const product = before
        ? await tx.product.update({ where: { id: before.id }, data: fields })
        : await tx.product.create({ data: fields });

      // ── Ангилал / арьсны асуудал
      const validCollections = await tx.collection.findMany({
        where: { id: { in: data.collectionIds } },
        select: { id: true },
      });
      const collectionIds = validCollections.map((c) => c.id);
      await tx.productCollection.deleteMany({
        where: { productId: product.id, collectionId: { notIn: collectionIds } },
      });
      if (collectionIds.length) {
        await tx.productCollection.createMany({
          data: collectionIds.map((collectionId) => ({ productId: product.id, collectionId })),
          skipDuplicates: true,
        });
      }

      // ── Зургууд (дараалал = массивын индекс)
      const keepImageIds = data.images.flatMap((i) => (i.id ? [i.id] : []));
      for (const img of before?.images ?? []) if (!keepImageIds.includes(img.id)) removedImageUrls.push(img.url);
      await tx.productImage.deleteMany({ where: { productId: product.id, id: { notIn: keepImageIds } } });
      for (const [sortOrder, img] of data.images.entries()) {
        const alt = img.alt || data.name;
        if (img.id) {
          await tx.productImage.updateMany({ where: { id: img.id, productId: product.id }, data: { alt, sortOrder } });
        } else {
          await tx.productImage.create({ data: { productId: product.id, url: img.url, alt, sortOrder } });
        }
      }

      // ── Хувилбарууд. Байгаа хувилбарыг хэзээ ч устгахгүй — архивлана.
      const existing = new Map((before?.variants ?? []).map((v) => [v.id, v]));
      const priceChanged = data.variants.some((v) => {
        const old = v.id ? existing.get(v.id) : undefined;
        return !old || old.price !== v.price || old.costPrice !== v.costPrice;
      });
      if (priceChanged && !can(user.role, "price:write")) throw new ForbiddenError("Үнэ өөрчлөх эрх танд байхгүй.");

      const sentIds: string[] = [];
      for (const [sortOrder, v] of data.variants.entries()) {
        const vf = {
          sku: v.sku,
          size: v.size,
          price: v.price,
          costPrice: v.costPrice,
          lowStockAt: v.lowStockAt,
          isActive: v.isActive,
          sortOrder,
        };
        if (v.id) {
          const old = existing.get(v.id);
          if (!old) throw new UserError("Хувилбар олдсонгүй. Хуудсаа шинэчилнэ үү.");
          await tx.variant.update({ where: { id: v.id }, data: vf });
          if (old.price !== v.price || old.costPrice !== v.costPrice) {
            await tx.priceHistory.create({
              data: {
                variantId: v.id,
                oldPrice: old.price,
                newPrice: v.price,
                oldCost: old.costPrice,
                newCost: v.costPrice,
                changedById: user.id,
              },
            });
          }
          sentIds.push(v.id);
        } else {
          // Шинэ хувилбар — үлдэгдэл 0, орлогыг "Үлдэгдэл" хэсгээс авна.
          const created = await tx.variant.create({ data: { ...vf, productId: product.id } });
          await tx.priceHistory.create({
            data: {
              variantId: created.id,
              oldPrice: 0,
              newPrice: v.price,
              oldCost: 0,
              newCost: v.costPrice,
              changedById: user.id,
            },
          });
          sentIds.push(created.id);
        }
      }
      await tx.variant.updateMany({
        where: { productId: product.id, id: { notIn: sentIds } },
        data: { isActive: false },
      });

      await audit(tx, {
        userId: user.id,
        action: before ? "product.update" : "product.create",
        entity: "Product",
        entityId: product.id,
        before: before && snapshot(before),
        after: { ...fields, collectionIds, images: data.images.map((i) => i.url), variants: data.variants },
      });
      return product.id;
    }, TX_OPTS);

    await Promise.all(removedImageUrls.map((u) => storage.remove(u)));
    refreshStorefront();
    return { id };
  }, "Бүтээгдэхүүн хадгалагдлаа.");
}

export async function setProductPublished(input: { id: string; isPublished: boolean }) {
  return runAction(async () => {
    const user = await requirePermission("product:write");
    await db.$transaction(async (tx) => {
      const before = await tx.product.findUnique({ where: { id: input.id }, select: { isPublished: true } });
      if (!before) throw new UserError("Бүтээгдэхүүн олдсонгүй.");
      await tx.product.update({ where: { id: input.id }, data: { isPublished: input.isPublished } });
      await audit(tx, {
        userId: user.id,
        action: input.isPublished ? "product.publish" : "product.archive",
        entity: "Product",
        entityId: input.id,
        before,
        after: { isPublished: input.isPublished },
      });
    });
    refreshStorefront();
  }, input.isPublished ? "Нийтэллээ." : "Архивлалаа (ноорог болголоо).");
}

function snapshot(p: {
  name: string;
  slug: string;
  subtitle: string;
  badge: string | null;
  isPublished: boolean;
  sortOrder: number;
  images: { url: string }[];
  collections: { collectionId: string }[];
  variants: { id: string; sku: string; size: string; price: number; costPrice: number; lowStockAt: number; isActive: boolean }[];
}) {
  return {
    name: p.name,
    slug: p.slug,
    subtitle: p.subtitle,
    badge: p.badge,
    isPublished: p.isPublished,
    sortOrder: p.sortOrder,
    collectionIds: p.collections.map((c) => c.collectionId),
    images: p.images.map((i) => i.url),
    variants: p.variants.map(({ id, sku, size, price, costPrice, lowStockAt, isActive }) => ({
      id, sku, size, price, costPrice, lowStockAt, isActive,
    })),
  };
}
