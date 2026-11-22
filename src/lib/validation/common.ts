import { z } from "zod";

export const REQUIRED = "Заавал бөглөнө.";

export const requiredText = (max = 200) =>
  z.string({ error: REQUIRED }).trim().min(1, REQUIRED).max(max, `${max} тэмдэгтээс ихгүй.`);

export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `${max} тэмдэгтээс ихгүй.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const slugSchema = z
  .string({ error: REQUIRED })
  .trim()
  .min(1, REQUIRED)
  .max(100, "100 тэмдэгтээс ихгүй.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Зөвхөн латин жижиг үсэг, тоо, зураас (-) ашиглана.");

/** Төгрөг: бүхэл, сөрөг биш */
export const moneySchema = z
  .number({ error: "Тоо оруулна уу." })
  .int("Бүхэл тоо оруулна уу.")
  .min(0, "Сөрөг байж болохгүй.")
  .max(1_000_000_000, "Хэт их дүн байна.");

export const intSchema = (min: number, max: number) =>
  z
    .number({ error: "Тоо оруулна уу." })
    .int("Бүхэл тоо оруулна уу.")
    .min(min, `${min}-ээс багагүй.`)
    .max(max, `${max}-ээс ихгүй.`);

/** Локал зам (/uploads/..., /placeholders/...) эсвэл https URL */
export const imageUrlSchema = z
  .string()
  .trim()
  .min(1, "Зураг оруулна уу.")
  .refine((v) => v.startsWith("/") || v.startsWith("https://"), "Зургийн хаяг буруу байна.");

export const hrefSchema = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "/-ээр эхэлсэн зам эсвэл бүтэн URL оруулна.");

export const idSchema = z.string().min(1).max(50);
