import { z } from "zod";
import { mn } from "@/i18n/mn";
import { REQUIRED, idSchema, imageUrlSchema, intSchema, moneySchema, optionalText, requiredText, slugSchema } from "./common";

export const BADGES = ["NEW", "ICONIC", "LIMITED", "ONLINE_EXCLUSIVE"] as const;
export const BADGE_LABELS: Record<(typeof BADGES)[number], string> = mn.badge;
export const PRODUCT_KINDS = ["SINGLE", "BUNDLE"] as const;
export const RELATION_TYPES = ["PROTOCOL", "SIMILAR", "BUNDLE_SUGGESTION"] as const;

const lines = (maxItems: number, maxLen: number) =>
  z
    .array(z.string().trim().max(maxLen, `${maxLen} тэмдэгтээс ихгүй.`))
    .max(maxItems, `${maxItems}-аас ихгүй мөр.`)
    .transform((arr) => arr.filter(Boolean));

/** "4 600 000 123 456" → "4600000123456" (the stored form; "" stays "") */
export const normBarcode = (raw: string | null | undefined) => (raw ?? "").replace(/\s+/g, "").toUpperCase();

/** "4 600 000 123 456" → "4600000123456"; латин үсэг, тоо, зураас; 4–32 тэмдэгт; хоосон → null */
export const barcodeSchema = z
  .string()
  .trim()
  .transform(normBarcode)
  .pipe(
    z
      .string()
      .max(32, "Баркод 32 тэмдэгтээс ихгүй.")
      .refine((v) => v === "" || /^[A-Z0-9-]{4,32}$/.test(v), "Баркод: тоо, латин үсэг, зураас (4–32 тэмдэгт)."),
  )
  .transform((v) => v || null)
  .nullish()
  .transform((v) => v ?? null);

export const variantInputSchema = z.object({
  id: idSchema.optional(),
  sku: z
    .string({ error: REQUIRED })
    .trim()
    .toUpperCase()
    .min(1, REQUIRED)
    .max(64)
    .regex(/^[A-Z0-9][A-Z0-9-]*$/, "SKU: латин том үсэг, тоо, зураас."),
  /** Баркод (EAN-13, UPC эсвэл дотоод код) — хоосон бол null */
  barcode: barcodeSchema,
  size: requiredText(50),
  price: moneySchema,
  costPrice: moneySchema,
  lowStockAt: intSchema(0, 10_000),
  isActive: z.boolean(),
});

export const productInputSchema = z
  .object({
    id: idSchema.optional(),
    name: requiredText(200),
    slug: slugSchema,
    kind: z.enum(PRODUCT_KINDS),
    tagline: optionalText(160),
    recommendedFor: optionalText(300),
    benefits: lines(6, 40),
    description: requiredText(5000),
    skinScience: optionalText(5000),
    howToUse: lines(12, 400),
    ingredients: optionalText(5000),
    environmental: z
      .array(z.object({ key: z.string().trim().max(80), value: z.string().trim().max(300) }))
      .max(12)
      .transform((rows) => rows.filter((r) => r.key && r.value)),
    clinicalNotes: lines(10, 500),
    seoTitle: optionalText(70),
    seoDescription: optionalText(170),
    badge: z.enum(BADGES).nullable(),
    isPublished: z.boolean(),
    sortOrder: intSchema(0, 100_000),
    collectionIds: z.array(idSchema).max(50),
    images: z
      .array(z.object({ id: idSchema.optional(), url: imageUrlSchema, alt: z.string().trim().max(200) }))
      .max(20, "20-оос олон зураг оруулах боломжгүй."),
    variants: z.array(variantInputSchema).min(1, "Дор хаяж нэг хувилбар нэмнэ үү.").max(20),
    relations: z.array(z.object({ relatedId: idSchema, type: z.enum(RELATION_TYPES) })).max(40),
    bundleItems: z.array(z.object({ variantId: idSchema, qty: intSchema(1, 20) })).max(12),
  })
  .superRefine((p, ctx) => {
    const seen = new Map<string, number>();
    p.variants.forEach((v, i) => {
      if (seen.has(v.sku)) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "SKU давхардсан байна." });
      }
      seen.set(v.sku, i);
    });
    const barcodes = new Map<string, number>();
    p.variants.forEach((v, i) => {
      if (!v.barcode) return;
      if (barcodes.has(v.barcode)) ctx.addIssue({ code: "custom", path: ["variants", i, "barcode"], message: "Баркод давхардсан байна." });
      barcodes.set(v.barcode, i);
    });
    if (p.isPublished && !p.variants.some((v) => v.isActive)) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Нийтлэхийн тулд дор хаяж нэг идэвхтэй хувилбар хэрэгтэй." });
    }
    if (p.kind === "BUNDLE" && p.bundleItems.length < 2) {
      ctx.addIssue({ code: "custom", path: ["bundleItems"], message: "Багцад дор хаяж 2 бүтээгдэхүүн нэмнэ үү." });
    }
    if (p.kind === "SINGLE" && p.bundleItems.length > 0) {
      ctx.addIssue({ code: "custom", path: ["bundleItems"], message: "Энгийн бүтээгдэхүүнд багцын бүрэлдэхүүн байхгүй." });
    }
    const relKeys = new Set<string>();
    p.relations.forEach((r, i) => {
      if (p.id && r.relatedId === p.id) {
        ctx.addIssue({ code: "custom", path: ["relations", i], message: "Бүтээгдэхүүнийг өөрт нь холбох боломжгүй." });
      }
      const k = `${r.type}:${r.relatedId}`;
      if (relKeys.has(k)) ctx.addIssue({ code: "custom", path: ["relations", i], message: "Давхардсан холбоос." });
      relKeys.add(k);
    });
    const bundleVariants = new Set<string>();
    p.bundleItems.forEach((b, i) => {
      if (bundleVariants.has(b.variantId)) {
        ctx.addIssue({ code: "custom", path: ["bundleItems", i], message: "Давхардсан бүрэлдэхүүн." });
      }
      bundleVariants.add(b.variantId);
    });
  });

export type ProductInput = z.input<typeof productInputSchema>;
export type VariantInput = z.input<typeof variantInputSchema>;
