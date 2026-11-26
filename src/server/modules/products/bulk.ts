/**
 * Бүтээгдэхүүнийг олноор архивлах / устгах (PROMPT 17 §B).
 *  - Архивлах = isPublished false (сайтаас нуугдана, түүх хэвээр).
 *  - Устгах = зөвхөн гүйлгээгүй бүтээгдэхүүн. Борлуулалт, агуулахын хөдөлгөөн, зөвлөмж, үйлчилгээний материал,
 *    багцад орсон хувилбартайг устгахгүй — оронд нь архивлана.
 * Storage-ийн зургийг устгахыг дуудагч (action) transaction-ы дараа хийнэ.
 */
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

export const bulkIdsSchema = z.object({ ids: z.array(z.string().min(1)).min(1, "Бүтээгдэхүүн сонгоно уу.").max(500) });

const TX_OPTS = { maxWait: 10_000, timeout: 60_000 } as const;

export async function bulkArchiveProducts(ids: string[], actorId: string) {
  return db.$transaction(async (tx) => {
    const targets = await tx.product.findMany({ where: { id: { in: ids }, isPublished: true }, select: { id: true, slug: true } });
    if (targets.length) await tx.product.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { isPublished: false } });
    for (const t of targets) await audit(tx, { userId: actorId, action: "product.archive", entity: "Product", entityId: t.id, before: { isPublished: true }, after: { isPublished: false, bulk: true } });
    return { archived: targets.length, slugs: targets.map((t) => t.slug) };
  }, TX_OPTS);
}

/** Гүйлгээтэй (Restrict FK-тай) бүтээгдэхүүний id-ууд */
async function productsWithHistory(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], ids: string[]) {
  const held = await tx.variant.findMany({
    where: {
      productId: { in: ids },
      OR: [{ saleItems: { some: {} } }, { stockMovements: { some: {} } }, { recommendations: { some: {} } }, { consumedBy: { some: {} } }, { inBundles: { some: {} } }],
    },
    select: { productId: true },
  });
  return new Set(held.map((v) => v.productId));
}

export async function bulkDeleteProducts(ids: string[], actorId: string) {
  return db.$transaction(async (tx) => {
    const products = await tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, name: true, isPublished: true, images: { select: { url: true } } } });
    const held = await productsWithHistory(tx, products.map((p) => p.id));
    const toDelete = products.filter((p) => !held.has(p.id));
    const toArchive = products.filter((p) => held.has(p.id));

    if (toArchive.length) await tx.product.updateMany({ where: { id: { in: toArchive.map((p) => p.id) }, isPublished: true }, data: { isPublished: false } });
    for (const p of toArchive) {
      if (p.isPublished) await audit(tx, { userId: actorId, action: "product.archive", entity: "Product", entityId: p.id, before: { isPublished: true }, after: { isPublished: false, reason: "has-history" } });
    }
    // Variant, зураг, ангиллын холбоос, холбоотой бүтээгдэхүүн, үнийн түүх — cascade
    if (toDelete.length) await tx.product.deleteMany({ where: { id: { in: toDelete.map((p) => p.id) } } });
    for (const p of toDelete) await audit(tx, { userId: actorId, action: "product.delete", entity: "Product", entityId: p.id, before: { name: p.name, slug: p.slug }, after: { bulk: true } });

    return {
      deleted: toDelete.length,
      archived: toArchive.length,
      slugs: products.map((p) => p.slug),
      removedImageUrls: toDelete.flatMap((p) => p.images.map((i) => i.url)),
    };
  }, TX_OPTS);
}

export function bulkDeleteMessage(r: { deleted: number; archived: number }) {
  if (!r.archived) return `${r.deleted} бүтээгдэхүүн устгалаа.`;
  if (!r.deleted) return `${r.archived} бүтээгдэхүүн гүйлгээтэй тул устгаагүй — архивлагдлаа.`;
  return `${r.deleted}-ийг устгав, ${r.archived} нь гүйлгээтэй тул архивлагдлаа.`;
}
