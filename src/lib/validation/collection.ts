import { z } from "zod";
import { idSchema, imageUrlSchema, intSchema, optionalText, requiredText, slugSchema } from "./common";

export const COLLECTION_KIND_LABELS = { CATEGORY: "Ангилал", CONCERN: "Арьсны асуудал" } as const;
export const NAV_GROUPS = { face: "Нүүрний арчилгаа", "body-hair": "Бие ба үс" } as const;

export const collectionInputSchema = z.object({
  id: idSchema.optional(),
  name: requiredText(120),
  slug: slugSchema,
  kind: z.enum(["CATEGORY", "CONCERN"]),
  description: optionalText(2000),
  image: imageUrlSchema.nullable(),
  navGroup: z.enum(["face", "body-hair"]).nullable(),
  sortOrder: intSchema(0, 100_000),
  showOnHome: z.boolean(),
});

export type CollectionInput = z.input<typeof collectionInputSchema>;
