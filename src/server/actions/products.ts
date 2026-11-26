"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { can } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { ForbiddenError, UserError } from "@/server/errors";
import { storage } from "@/server/storage";
import { z } from "zod";
import { productInputSchema, type ProductInput } from "@/lib/validation/product";
import { bulkArchiveProducts as archiveMany, bulkDeleteMessage, bulkDeleteProducts as deleteMany, bulkIdsSchema } from "@/server/modules/products/bulk";
import { parseInput, runAction } from "./result";

const TX_OPTS = { maxWait: 10_000, timeout: 30_000 } as const;

function refreshStorefront(slugs: string[] = []) {
  updateTag("catalog");
  revalidatePath("/");
  // Бүтээгдэхүүн / ангиллын хуудсууд (generateStaticParams-аар prerender хийгдсэн)
  revalidatePath("/products/[slug]", "page");
  revalidatePath("/collections/[slug]", "page");
  for (const slug of slugs) revalidatePath(`/products/${slug}`);
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
            include: { variants: true, images: true, collections: true, relations: true, bundleItems: true },
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
      const barcodes = data.variants.map((v) => v.barcode).filter((b): b is string => Boolean(b));
      if (barcodes.length) {
        const owners = await tx.variant.findMany({ where: { barcode: { in: barcodes } }, select: { id: true, barcode: true } });
        const errors: Record<string, string[]> = {};
        data.variants.forEach((v, i) => {
          const owner = owners.find((o) => o.barcode === v.barcode);
          if (owner && owner.id !== v.id) errors[`variants.${i}.barcode`] = ["Энэ баркод өөр хувилбарт ашиглагдсан."];
        });
        if (Object.keys(errors).length) throw new UserError("Баркод давхардсан байна.", errors);
      }

      const fields = {
        name: data.name,
        slug: data.slug,
        kind: data.kind,
        tagline: data.tagline,
        recommendedFor: data.recommendedFor,
        benefits: data.benefits,
        description: data.description,
        skinScience: data.skinScience,
        howToUse: data.howToUse,
        ingredients: data.ingredients,
        environmental: Object.fromEntries(data.environmental.map((r) => [r.key, r.value])),
        clinicalNotes: data.clinicalNotes,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
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
        // Шинээр нэмэгдсэн нь ангиллын төгсгөлд; дарааллыг ангиллын формоос өөрчилнө
        await tx.productCollection.createMany({
          data: collectionIds.map((collectionId) => ({ productId: product.id, collectionId, position: 9999 })),
          skipDuplicates: true,
        });
      }

      // ── Холбоосууд (Хамт хэрэглэх / Төстэй / Төгс хослол) — дараалал = массивын индекс
      const relatedIds = [...new Set(data.relations.map((r) => r.relatedId))];
      const validRelated = new Set(
        (await tx.product.findMany({ where: { id: { in: relatedIds } }, select: { id: true } })).map((p) => p.id),
      );
      await tx.productRelation.deleteMany({ where: { productId: product.id } });
      const positions: Record<string, number> = {};
      const relationRows = data.relations
        .filter((r) => validRelated.has(r.relatedId) && r.relatedId !== product.id)
        .map((r) => ({ productId: product.id, relatedId: r.relatedId, type: r.type, position: (positions[r.type] = (positions[r.type] ?? -1) + 1) }));
      if (relationRows.length) await tx.productRelation.createMany({ data: relationRows });

      // ── Багцын бүрэлдэхүүн
      await tx.bundleItem.deleteMany({ where: { bundleProductId: product.id } });
      if (data.kind === "BUNDLE" && data.bundleItems.length) {
        const found = await tx.variant.findMany({
          where: { id: { in: data.bundleItems.map((b) => b.variantId) }, productId: { not: product.id } },
          select: { id: true },
        });
        if (found.length !== data.bundleItems.length) throw new UserError("Багцын зарим бүрэлдэхүүн олдсонгүй.", { bundleItems: ["Бүрэлдэхүүнээ шалгана уу."] });
        await tx.bundleItem.createMany({
          data: data.bundleItems.map((b, position) => ({ bundleProductId: product.id, variantId: b.variantId, qty: b.qty, position })),
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
          barcode: v.barcode,
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
        after: {
          ...fields,
          collectionIds,
          images: data.images.map((i) => i.url),
          variants: data.variants,
          relations: relationRows.map(({ relatedId, type }) => ({ relatedId, type })),
          bundleItems: data.bundleItems,
        },
      });
      return product.id;
    }, TX_OPTS);

    await Promise.all(removedImageUrls.map((u) => storage.remove(u)));
    refreshStorefront([data.slug]);
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
  }, input.isPublished ? "Нийтэллээ." : "Сайтаас нууллаа.");
}

function snapshot(p: {
  name: string;
  slug: string;
  kind: string;
  tagline: string | null;
  benefits: string[];
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
    kind: p.kind,
    tagline: p.tagline,
    benefits: p.benefits,
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

/** Холбоос нэмэхэд: нэрээр хайна */
export async function searchProducts(query: string) {
  return runAction(async () => {
    await requirePermission("product:write");
    const q = z.string().trim().max(100).parse(query);
    const rows = await db.product.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } : {},
      orderBy: [{ isPublished: "desc" }, { name: "asc" }],
      take: 15,
      select: { id: true, name: true, kind: true },
    });
    return rows.map((p) => ({ id: p.id, label: p.name, hint: p.kind === "BUNDLE" ? "BUNDLE" : undefined }));
  });
}

/** Олноор архивлах (сайтаас нуух) — ADMIN/MANAGER (product:write) */
export async function bulkArchiveProducts(input: { ids: string[] }) {
  return runAction(async () => {
    const user = await requirePermission("product:write");
    const { ids } = parseInput(bulkIdsSchema, input);
    const r = await archiveMany(ids, user.id);
    refreshStorefront(r.slugs);
    return { archived: r.archived };
  });
}

/** Олноор устгах: гүйлгээгүйг устгана, гүйлгээтэйг архивлана */
export async function bulkDeleteProducts(input: { ids: string[] }) {
  return runAction(async () => {
    const user = await requirePermission("product:write");
    const { ids } = parseInput(bulkIdsSchema, input);
    const r = await deleteMany(ids, user.id);
    // DB-ээс устсаны дараа л storage-ийн зураг (алдаа гарвал зураг үлдэх нь хор хөнөөлгүй)
    await Promise.all(r.removedImageUrls.map((u) => storage.remove(u).catch(() => undefined)));
    refreshStorefront(r.slugs);
    return { deleted: r.deleted, archived: r.archived, message: bulkDeleteMessage(r) };
  });
}
