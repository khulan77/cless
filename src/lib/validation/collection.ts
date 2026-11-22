import { z } from "zod";
import { hrefSchema, idSchema, imageUrlSchema, intSchema, optionalText, requiredText, slugSchema } from "./common";

export const COLLECTION_KIND_LABELS = { CATEGORY: "Ангилал", CONCERN: "Арьсны хэрэгцээ" } as const;

export const collectionTileSchema = z.object({
  id: idSchema.optional(),
  position: intSchema(1, 500),
  image: imageUrlSchema,
  eyebrow: optionalText(40),
  title: requiredText(80),
  text: optionalText(200),
  ctaLabel: optionalText(40),
  ctaHref: hrefSchema.nullish().transform((v) => v || null),
});

export const collectionInputSchema = z
  .object({
    id: idSchema.optional(),
    name: requiredText(120),
    slug: slugSchema,
    kind: z.enum(["CATEGORY", "CONCERN"]),
    parentId: idSchema.nullable(),
    heading: optionalText(120),
    intro: optionalText(600),
    seoText: optionalText(3000),
    bannerImage: imageUrlSchema.nullable(),
    tileImage: imageUrlSchema.nullable(),
    showInMenu: z.boolean(),
    sortOrder: intSchema(0, 100_000),
    showOnHome: z.boolean(),
    /** Ангилал доторх бүтээгдэхүүний дараалал (productId-ууд) */
    productOrder: z.array(idSchema).max(500),
    tiles: z.array(collectionTileSchema).max(10),
  })
  .superRefine((c, ctx) => {
    if (c.id && c.parentId === c.id) {
      ctx.addIssue({ code: "custom", path: ["parentId"], message: "Ангиллыг өөрийнх нь эцэг болгох боломжгүй." });
    }
  });

export type CollectionInput = z.input<typeof collectionInputSchema>;
export type CollectionTileInput = z.input<typeof collectionTileSchema>;
