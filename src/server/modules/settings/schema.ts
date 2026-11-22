/** POS / татвар / QPay тохиргооны schema — цэвэр (DB-гүй) */
import { z } from "zod";

export const posSettingsSchema = z.object({
  /** MANAGER-ийн хийж болох нийт хөнгөлөлтийн дээд хувь */
  maxManagerDiscountPercent: z.number().min(0).max(100).catch(10),
  allowNegativeStock: z.boolean().catch(false),
  /** Төлбөргүй гацсан PENDING_PAYMENT-ийг автоматаар буцаах хугацаа (минут) */
  staleLockMinutes: z.number().int().min(5).max(24 * 60).catch(30),
  /** Касс хаахад үүнээс их (абсолют) зөрүү гарвал онцгой анхааруулна, ₮ */
  shiftDifferenceThreshold: z.number().int().min(0).max(10_000_000).catch(5000),
});

/** Имэйлийн илгээгч. Хоосон бол EMAIL_FROM env-ийг ашиглана. */
export const emailSettingsSchema = z.object({
  fromName: z.string().trim().max(80).catch(""),
  fromAddress: z.string().trim().max(200).catch(""),
  replyTo: z.string().trim().max(200).catch(""),
});
export type EmailSettings = z.infer<typeof emailSettingsSchema>;

/** Системийн төлөв: "Нээлт хийгдсэн" (seed/reset хориглоно) */
export const systemSettingsSchema = z.object({
  launchedAt: z.string().nullable().catch(null),
});
export type SystemSettings = z.infer<typeof systemSettingsSchema>;

export const taxSettingsSchema = z.object({
  vatIncluded: z.boolean().catch(true),
  /** 1000 = 10% */
  vatRateBp: z.number().int().min(0).max(5000).catch(1000),
});

export const qpaySettingsSchema = z.object({
  mode: z.enum(["api", "manual"]).catch("manual"),
});

const hm = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/);
export const intervalSchema = z
  .object({ start: hm, end: hm })
  .refine((i) => i.start < i.end, "Эхлэх цаг дуусахаас өмнө байх ёстой.");

/** Салбарын ажлын цаг: weekday ("0" = Ням … "6" = Бямба) → интервалууд. Хоосон = амралтын өдөр. */
const DEFAULT_HOURS: Record<string, { start: string; end: string }[]> = {
  "0": [],
  "1": [{ start: "10:00", end: "20:00" }],
  "2": [{ start: "10:00", end: "20:00" }],
  "3": [{ start: "10:00", end: "20:00" }],
  "4": [{ start: "10:00", end: "20:00" }],
  "5": [{ start: "10:00", end: "20:00" }],
  "6": [{ start: "10:00", end: "20:00" }],
};

export const DEFAULT_CANCEL_REASONS = ["Үйлчлүүлэгч цуцалсан", "Цаг өөрчилсөн", "Өвчтэй", "Ажилтан боломжгүй", "Бусад"];

export const bookingSettingsSchema = z.object({
  hours: z.partialRecord(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(intervalSchema).max(6)).catch(DEFAULT_HOURS),
  /** Календарийн мөр ба сул цагийн алхам */
  slotMinutes: z.number().int().refine((v) => [5, 10, 15, 20, 30, 60].includes(v)).catch(15),
  /** Одоогоос хамгийн багадаа хэдэн минутын дараах цаг санал болгох */
  minLeadMinutes: z.number().int().min(0).max(24 * 60).catch(0),
  cancelReasons: z.array(z.string().trim().min(1).max(80)).min(1).max(20).catch(DEFAULT_CANCEL_REASONS),
  /** Сануулга илгээх (цаг эхлэхээс өмнө, цаг) */
  reminderHours: z.number().int().min(1).max(72).catch(24),
});

export type BookingSettings = z.infer<typeof bookingSettingsSchema>;
export type PosSettings = z.infer<typeof posSettingsSchema>;
export type TaxSettings = z.infer<typeof taxSettingsSchema>;
export type QPaySettings = z.infer<typeof qpaySettingsSchema>;
