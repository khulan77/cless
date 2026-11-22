import { z } from "zod";
import { REQUIRED, idSchema, imageUrlSchema, intSchema, moneySchema, optionalText, requiredText, slugSchema } from "./common";

export const BADGES = ["NEW", "ICONIC", "LIMITED"] as const;
export const BADGE_LABELS: Record<(typeof BADGES)[number], string> = {
  NEW: "Шинэ",
  ICONIC: "Иконик",
  LIMITED: "Хязгаарлагдмал",
};

export const variantInputSchema = z.object({
  id: idSchema.optional(),
  sku: z
    .string({ error: REQUIRED })
    .trim()
    .toUpperCase()
    .min(1, REQUIRED)
    .max(64)
    .regex(/^[A-Z0-9][A-Z0-9-]*$/, "SKU: латин том үсэг, тоо, зураас."),
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
    subtitle: requiredText(200),
    description: requiredText(5000),
    howToUse: requiredText(5000),
    ingredients: optionalText(5000),
    badge: z.enum(BADGES).nullable(),
    isPublished: z.boolean(),
    sortOrder: intSchema(0, 100_000),
    collectionIds: z.array(idSchema).max(50),
    images: z
      .array(z.object({ id: idSchema.optional(), url: imageUrlSchema, alt: z.string().trim().max(200) }))
      .max(20, "20-оос олон зураг оруулах боломжгүй."),
    variants: z.array(variantInputSchema).min(1, "Дор хаяж нэг хувилбар нэмнэ үү.").max(20),
  })
  .superRefine((p, ctx) => {
    const seen = new Map<string, number>();
    p.variants.forEach((v, i) => {
      const prev = seen.get(v.sku);
      if (prev !== undefined) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "SKU давхардсан байна." });
      }
      seen.set(v.sku, i);
    });
    if (p.isPublished && !p.variants.some((v) => v.isActive)) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Нийтлэхийн тулд дор хаяж нэг идэвхтэй хувилбар хэрэгтэй." });
    }
  });

export type ProductInput = z.input<typeof productInputSchema>;
export type VariantInput = z.input<typeof variantInputSchema>;
