import { z } from "zod";
import { idSchema, imageUrlSchema, intSchema, moneySchema, optionalText, requiredText, slugSchema } from "./common";

export const serviceInputSchema = z
  .object({
    id: idSchema.optional(),
    name: requiredText(200),
    slug: slugSchema,
    description: requiredText(5000),
    durationMin: intSchema(5, 600),
    bufferMin: intSchema(0, 120),
    requiresRoom: z.boolean(),
    bookable: z.boolean(),
    /** Сайтын /services хуудсанд харагдах эсэх */
    isPublic: z.boolean().default(true),
    category: optionalText(80),
    shortDescription: optionalText(240),
    suitableFor: optionalText(1000),
    results: optionalText(1000),
    priceFrom: z.boolean().default(false),
    price: moneySchema,
    costNote: optionalText(1000),
    image: imageUrlSchema.nullable(),
    isActive: z.boolean(),
    sortOrder: intSchema(0, 100_000),
    consumables: z
      .array(
        z.object({
          variantId: idSchema,
          qtyPerService: z
            .number({ error: "Тоо оруулна уу." })
            .gt(0, "0-ээс их байх ёстой.")
            .max(10, "10 савнаас ихгүй."),
        }),
      )
      .max(30),
  })
  .superRefine((s, ctx) => {
    const ids = new Set<string>();
    s.consumables.forEach((c, i) => {
      if (ids.has(c.variantId)) {
        ctx.addIssue({ code: "custom", path: ["consumables", i, "variantId"], message: "Энэ бүтээгдэхүүн давхардсан." });
      }
      ids.add(c.variantId);
    });
  });

export type ServiceInput = z.input<typeof serviceInputSchema>;
