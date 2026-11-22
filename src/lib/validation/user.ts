import { z } from "zod";
import { REQUIRED, idSchema, moneySchema, optionalText, requiredText } from "./common";

export const ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;

const email = z.string({ error: REQUIRED }).trim().toLowerCase().pipe(z.email("Имэйл хаяг буруу байна."));
export const passwordSchema = z
  .string({ error: REQUIRED })
  .min(10, "Нууц үг дор хаяж 10 тэмдэгт.")
  .max(100, "100 тэмдэгтээс ихгүй.");

export const createUserSchema = z.object({
  name: requiredText(120),
  email,
  phone: optionalText(30),
  role: z.enum(ROLES),
  baseSalary: moneySchema,
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  id: idSchema,
  name: requiredText(120),
  phone: optionalText(30),
  role: z.enum(ROLES),
  baseSalary: moneySchema,
  isActive: z.boolean(),
});

export const resetPasswordSchema = z.object({ id: idSchema, password: passwordSchema });

export type CreateUserInput = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.input<typeof updateUserSchema>;
