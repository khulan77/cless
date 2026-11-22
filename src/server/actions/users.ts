"use server";

import { bookableAfterRoleChange, defaultBookable } from "@/server/modules/appointments/bookable";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requirePermission } from "@/server/auth/session";
import { UserError } from "@/server/errors";
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validation/user";
import { parseInput, runAction } from "./result";

const publicFields = { id: true, name: true, email: true, phone: true, role: true, isActive: true, isBookable: true, baseSalary: true } as const;

/** Идэвхтэй админуудыг түгжиж тоолно — зэрэг өөрчлөлтөөс сүүлийн админыг хамгаална */
async function lockActiveAdmins(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "role" = 'ADMIN' AND "isActive" = true FOR UPDATE`;
  return rows.map((r) => r.id);
}

export async function createUser(input: CreateUserInput) {
  return runAction(async () => {
    const actor = await requirePermission("user:write");
    const data = parseInput(createUserSchema, input);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await db.$transaction(async (tx) => {
      const exists = await tx.user.findUnique({ where: { email: data.email }, select: { id: true } });
      if (exists) throw new UserError("Энэ имэйлтэй хэрэглэгч бүртгэлтэй байна.", { email: ["Давхардсан имэйл."] });
      const created = await tx.user.create({
        data: { name: data.name, email: data.email, phone: data.phone, role: data.role, baseSalary: data.baseSalary, passwordHash, isBookable: defaultBookable(data.role) },
        select: publicFields,
      });
      await audit(tx, { userId: actor.id, action: "user.create", entity: "User", entityId: created.id, after: created });
      return created;
    });
    revalidatePath("/admin/users");
    return { id: user.id };
  }, "Хэрэглэгч нэмэгдлээ.");
}

export async function updateUser(input: UpdateUserInput) {
  return runAction(async () => {
    const actor = await requirePermission("user:write");
    const data = parseInput(updateUserSchema, input);

    await db.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id: data.id }, select: publicFields });
      if (!before) throw new UserError("Хэрэглэгч олдсонгүй.");

      if (data.id === actor.id) {
        if (!data.isActive) throw new UserError("Өөрийгөө идэвхгүй болгох боломжгүй.", { isActive: ["Өөрийгөө идэвхгүй болгох боломжгүй."] });
        if (data.role !== before.role) throw new UserError("Өөрийнхөө эрхийг өөрчлөх боломжгүй.", { role: ["Өөрийнхөө эрхийг өөрчлөх боломжгүй."] });
      }

      const losesAdmin = before.role === "ADMIN" && before.isActive && (data.role !== "ADMIN" || !data.isActive);
      if (losesAdmin) {
        const admins = await lockActiveAdmins(tx);
        if (admins.filter((id) => id !== data.id).length === 0) {
          throw new UserError("Сүүлийн идэвхтэй админы эрхийг бууруулах / идэвхгүй болгох боломжгүй.");
        }
      }

      const after = await tx.user.update({
        where: { id: data.id },
        data: {
          name: data.name,
          phone: data.phone,
          role: data.role,
          baseSalary: data.baseSalary,
          isActive: data.isActive,
          isBookable: bookableAfterRoleChange(before, data.role),
        },
        select: publicFields,
      });
      const action = before.isActive && !after.isActive ? "user.deactivate" : !before.isActive && after.isActive ? "user.activate" : "user.update";
      await audit(tx, { userId: actor.id, action, entity: "User", entityId: data.id, before, after });
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${data.id}`);
  }, "Хэрэглэгчийн мэдээлэл хадгалагдлаа.");
}

export async function resetPassword(input: { id: string; password: string }) {
  return runAction(async () => {
    const actor = await requirePermission("user:write");
    const data = parseInput(resetPasswordSchema, input);
    const passwordHash = await bcrypt.hash(data.password, 12);
    await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: data.id }, select: { email: true } });
      if (!user) throw new UserError("Хэрэглэгч олдсонгүй.");
      await tx.user.update({ where: { id: data.id }, data: { passwordHash } });
      // Нууц үг хэзээ ч лог-д орохгүй
      await audit(tx, { userId: actor.id, action: "user.reset_password", entity: "User", entityId: data.id });
      // Түгжигдсэн бол нээх
      await tx.loginAttempt.deleteMany({ where: { key: `email:${user.email}`, success: false } });
    });
  }, "Нууц үг шинэчлэгдлээ.");
}
