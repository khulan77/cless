/**
 * Өөрийн нууц үг солих. Амжилттай бол passwordChangedAt шинэчлэгдэж бүх session хүчингүй болно.
 */
import bcrypt from "bcryptjs";
import { z } from "zod";
import { passwordSchema } from "@/lib/validation/user";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Одоогийн нууц үгээ оруулна уу.").max(200),
    next: passwordSchema,
    confirm: z.string().max(200),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Нууц үг таарахгүй байна." })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Шинэ нууц үг өмнөхөөсөө өөр байх ёстой." });

export async function changeOwnPassword(userId: string, raw: z.input<typeof changePasswordSchema>, now = new Date()) {
  const data = changePasswordSchema.parse(raw);
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new UserError("Хэрэглэгч олдсонгүй.");
  if (!(await bcrypt.compare(data.current, user.passwordHash))) {
    throw new UserError("Одоогийн нууц үг буруу байна.", { current: ["Буруу нууц үг."] });
  }
  const passwordHash = await bcrypt.hash(data.next, 12);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false, passwordChangedAt: now } });
    await audit(tx, { userId, action: "user.change_password", entity: "User", entityId: userId });
  });
}
