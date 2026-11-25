/**
 * Excel импорт: DB-ээс контекст ачаалах, урьдчилан харах, импортлох.
 *
 * Бичилт бүгд одоо байгаа service-үүдээр:
 *  - saveProduct (src/server/actions/products.ts) — validation, PriceHistory, AuditLog, updateTag("catalog")
 *  - receiveStock (src/server/actions/stock.ts) — PURCHASE StockMovement (өртөгтэй), FOR UPDATE түгжээ
 * Prisma-аар шууд бичихгүй.
 *
 * Transaction: бүтээгдэхүүн тус бүр saveProduct-ийн өөрийн transaction-д (нэг алдаа бусдыг зогсоохгүй),
 * эцэст нь тайлан. Импортын өмнө бүх мөр алдаагүй байх ёстой (урьдчилан харах = бодит шалгалт).
 */
import "server-only";
import { db } from "@/server/db";
import { saveProduct } from "@/server/actions/products";
import { receiveStock } from "@/server/actions/stock";
import { storage } from "@/server/storage";
import { infra } from "@/i18n/mn.infra";
import { normBarcode } from "@/lib/validation/product";
import type { ParsedWorkbook } from "./parse";
import { ImageFetchError, fetchImage } from "./images";
import { buildImportPlan, type ExistingProduct, type ImportContext, type ImportPlan } from "./validate";

const W = infra.import.warn;

export async function loadImportContext(parsed: ParsedWorkbook): Promise<ImportContext> {
  const slugs = [...new Set(parsed.products.map((p) => p.values.slug.trim().toLowerCase()).filter(Boolean))];
  const skus = [...new Set(parsed.variants.map((v) => v.values.sku.trim().toUpperCase()).filter(Boolean))];
  const barcodes = [...new Set(parsed.variants.map((v) => normBarcode(v.values.barcode)).filter(Boolean))];

  const [collections, rows, owners, codeOwners] = await Promise.all([
    db.collection.findMany({ select: { id: true, slug: true, kind: true } }),
    db.product.findMany({
      where: { slug: { in: slugs } },
      include: {
        images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
        variants: { orderBy: { sortOrder: "asc" } },
        collections: { select: { collectionId: true } },
        relations: { orderBy: [{ type: "asc" }, { position: "asc" }], select: { relatedId: true, type: true } },
        bundleItems: { orderBy: { position: "asc" }, select: { variantId: true, qty: true } },
      },
    }),
    db.variant.findMany({ where: { sku: { in: skus } }, select: { sku: true, product: { select: { slug: true } } } }),
    db.variant.findMany({ where: { barcode: { in: barcodes } }, select: { sku: true, barcode: true } }),
  ]);

  const products = new Map<string, ExistingProduct>(
    rows.map((p) => [
      p.slug,
      {
        id: p.id,
        slug: p.slug,
        name: p.name,
        kind: p.kind,
        tagline: p.tagline,
        recommendedFor: p.recommendedFor,
        benefits: p.benefits,
        description: p.description,
        skinScience: p.skinScience,
        howToUse: p.howToUse,
        ingredients: p.ingredients,
        environmental: (p.environmental && typeof p.environmental === "object" && !Array.isArray(p.environmental)
          ? Object.fromEntries(Object.entries(p.environmental).map(([k, v]) => [k, String(v)]))
          : {}) as Record<string, string>,
        clinicalNotes: p.clinicalNotes,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        badge: p.badge,
        isPublished: p.isPublished,
        sortOrder: p.sortOrder,
        images: p.images,
        variants: p.variants.map(({ id, sku, barcode, size, price, costPrice, lowStockAt, isActive }) => ({
          id, sku, barcode, size, price, costPrice, lowStockAt, isActive,
        })),
        collectionIds: p.collections.map((c) => c.collectionId),
        relations: p.relations,
        bundleItems: p.bundleItems,
      },
    ]),
  );
  return {
    collections,
    products,
    skuOwners: new Map(owners.map((o) => [o.sku, o.product.slug])),
    barcodeOwners: new Map(codeOwners.map((o) => [o.barcode!, o.sku])),
  };
}

export async function planImport(parsed: ParsedWorkbook): Promise<ImportPlan> {
  return buildImportPlan(parsed, await loadImportContext(parsed));
}

/** UI-д буцаах хэлбэр (ProductInput-гүй) */
export type ImportPreview = Omit<ImportPlan, "products"> & {
  products: Omit<ImportPlan["products"][number], "input">[];
};

export function toPreview(plan: ImportPlan): ImportPreview {
  return {
    ...plan,
    products: plan.products.map((p) => {
      const { input, ...rest } = p;
      void input;
      return rest;
    }),
  };
}

export type ImportReport = {
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  stockReceived: number;
  imagesDownloaded: number;
  errors: string[];
  warnings: string[];
};

export type ImportDeps = { fetchImage: typeof fetchImage };

export async function executeImport(plan: ImportPlan, deps: ImportDeps = { fetchImage }): Promise<ImportReport> {
  const report: ImportReport = {
    created: 0,
    updated: 0,
    unchanged: plan.summary.unchanged,
    failed: 0,
    stockReceived: 0,
    imagesDownloaded: 0,
    errors: [],
    warnings: plan.products.flatMap((p) => p.warnings),
  };

  for (const p of plan.products) {
    if (!p.input || (p.action !== "create" && p.action !== "update")) continue;

    // ── Зураг (алдаа нь анхааруулга, импорт зогсохгүй)
    const uploaded: string[] = [];
    const newImages: { url: string; alt: string }[] = [];
    for (const url of p.imageUrls) {
      if (url.startsWith("/uploads/")) {
        newImages.push({ url, alt: p.name });
        continue;
      }
      try {
        const file = await deps.fetchImage(url);
        const { url: stored } = await storage.put(file, "products");
        uploaded.push(stored);
        newImages.push({ url: stored, alt: p.name });
      } catch (e) {
        report.warnings.push(W.imageFailed(p.slug, url, e instanceof ImageFetchError ? e.message : infra.import.image.network));
      }
    }

    const res = await saveProduct({ ...p.input, images: [...p.input.images, ...newImages] });
    if (!res.ok) {
      report.failed++;
      report.errors.push(`«${p.slug}»: ${res.error}${res.fieldErrors ? ` (${Object.values(res.fieldErrors).flat().join("; ")})` : ""}`);
      await Promise.all(uploaded.map((u) => storage.remove(u)));
      continue;
    }
    report.imagesDownloaded += uploaded.length;
    if (p.action === "create") report.created++;
    else report.updated++;

    // ── Эхний үлдэгдэл: зөвхөн энэ импортоор шинээр үүссэн хувилбарт
    const withStock = p.variants.filter((v) => v.action === "create" && v.initialStock > 0);
    if (withStock.length) {
      const ids = await db.variant.findMany({
        where: { productId: res.data.id, sku: { in: withStock.map((v) => v.sku) } },
        select: { id: true, sku: true },
      });
      for (const v of withStock) {
        const id = ids.find((x) => x.sku === v.sku)?.id;
        if (!id) continue;
        const r = await receiveStock({ variantId: id, qty: v.initialStock, unitCost: v.costPrice, note: "Excel импорт — эхний үлдэгдэл" });
        if (r.ok) report.stockReceived++;
        else report.warnings.push(W.stockFailed(v.sku, r.error));
      }
    }
  }
  return report;
}
