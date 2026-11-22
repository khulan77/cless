import { z } from "zod";
import { idSchema, intSchema, moneySchema, optionalText } from "./common";

export const receiveStockSchema = z.object({
  variantId: idSchema,
  qty: intSchema(1, 100_000),
  unitCost: moneySchema.nullable(),
  note: optionalText(500),
});

export const adjustStockSchema = z.object({
  variantId: idSchema,
  newQty: intSchema(0, 100_000),
  reason: z.string().trim().min(3, "Шалтгаанаа бичнэ үү.").max(500),
});

export type ReceiveStockInput = z.input<typeof receiveStockSchema>;
export type AdjustStockInput = z.input<typeof adjustStockSchema>;
