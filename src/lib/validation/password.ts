import { z } from "zod";

/** Хэт энгийн нууц үгс (жижиг үсгээр харьцуулна) — нийтлэг жагсаалтаас */
const COMMON = new Set([
  "12345678", "123456789", "1234567890", "87654321", "11111111", "00000000", "88888888", "99999999", "12341234", "11223344",
  "password", "password1", "password123", "passw0rd", "qwerty123", "qwertyui", "qwerty12", "1q2w3e4r", "1qaz2wsx", "abc12345",
  "abcd1234", "iloveyou", "sunshine", "princess", "football", "baseball", "welcome1", "admin123", "administrator", "letmein1",
  "zxcvbnm1", "asdfghjk", "monkey12", "dragon12", "master12", "superman", "cless123", "cless2026", "biologique", "mongolia",
  "ulaanbaatar", "nuutsug1", "nuuts123", "salon123", "spa12345",
]);

export const PASSWORD_MIN = 8;

/** Шинэ нууц үг (идэвхжүүлэх, сэргээх): 8+ тэмдэгт, энгийн жагсаалтад биш, нэг тэмдэгт давтсан биш */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Нууц үг дор хаяж ${PASSWORD_MIN} тэмдэгт.`)
  .max(100, "100 тэмдэгтээс ихгүй.")
  .refine((p) => !COMMON.has(p.toLowerCase()), "Хэт энгийн нууц үг байна. Өөр нууц үг сонгоно уу.")
  .refine((p) => new Set(p).size > 2, "Хэт энгийн нууц үг байна. Өөр нууц үг сонгоно уу.");

export const passwordPairSchema = z
  .object({ password: newPasswordSchema, confirm: z.string().max(100) })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Нууц үг таарахгүй байна." });
