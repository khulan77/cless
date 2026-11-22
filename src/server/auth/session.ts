import "server-only";
import { forbidden, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";
import { can, type Permission } from "./permissions";

export type CurrentUser = Awaited<ReturnType<typeof loadUser>>;

async function loadUser(id: string) {
  return db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
}

/**
 * Session-ийг DB-тэй тулгана: role болон isActive-ийг JWT-ээс биш DB-ээс уншина.
 * Тиймээс эрх бууруулах / идэвхгүй болгох нь даруй хүчинтэй.
 */
export const getCurrentUser = cache(async () => {
  // Session нь request-ээс хамаарна — prerender хийхгүй (auth() дотор crypto ашиглагддаг)
  await connection();
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await loadUser(id);
  if (!user || !user.isActive) return null;
  return user;
});

/** Хуудсанд: нэвтрээгүй бол login руу */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Хуудсанд: эрхгүй бол 403 хуудас */
export async function requirePagePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) forbidden();
  return user;
}

/** Server Action-д: эхэнд нь заавал дуудна. Эрхгүй бол ForbiddenError (403). */
export async function requirePermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (!can(user.role, permission)) throw new ForbiddenError();
  return user;
}

/** Хэд хэдэн эрхийн аль нэг нь байхад хангалттай үед */
export async function requireAnyPermission(...permissions: Permission[]) {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (!permissions.some((p) => can(user.role, p))) throw new ForbiddenError();
  return user;
}
