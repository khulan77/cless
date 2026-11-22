/** POS / татвар / QPay тохиргооны schema — цэвэр (DB-гүй) */
import { z } from "zod";

export const posSettingsSchema = z.object({
  /** MANAGER-ийн хийж болох нийт хөнгөлөлтийн дээд хувь */
  maxManagerDiscountPercent: z.number().min(0).max(100).catch(10),
  allowNegativeStock: z.boolean().catch(false),
  /** Төлбөргүй гацсан PENDING_PAYMENT-ийг автоматаар буцаах хугацаа (минут) */
  staleLockMinutes: z.number().int().min(5).max(24 * 60).catch(30),
});

export const taxSettingsSchema = z.object({
  vatIncluded: z.boolean().catch(true),
  /** 1000 = 10% */
  vatRateBp: z.number().int().min(0).max(5000).catch(1000),
});

export const qpaySettingsSchema = z.object({
  mode: z.enum(["api", "manual"]).catch("manual"),
});

export type PosSettings = z.infer<typeof posSettingsSchema>;
export type TaxSettings = z.infer<typeof taxSettingsSchema>;
export type QPaySettings = z.infer<typeof qpaySettingsSchema>;
