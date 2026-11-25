/**
 * Хэн хэнийг нэмж/засаж/идэвхгүй болгох вэ (PROMPT 15 §2) — цэвэр функц:
 *   ADMIN   → ADMIN, MANAGER, ACCOUNTANT, STAFF
 *   MANAGER → зөвхөн STAFF (бусдыг харна, засахгүй)
 *   ACCOUNTANT, STAFF → хэнийг ч үгүй
 * Үндсэн цалин: ADMIN, ACCOUNTANT (payroll:write).
 */
import type { Role } from "@/generated/prisma/enums";
import { can } from "@/server/auth/permissions";

const ALL: readonly Role[] = ["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF"];

export function assignableRoles(actor: Role): readonly Role[] {
  if (can(actor, "user:write")) return ALL;
  if (can(actor, "user:write:staff")) return ["STAFF"];
  return [];
}

/** Тухайн хэрэглэгчийг (одоогийн role-оор) засах эрхтэй эсэх */
export function canManageUser(actor: Role, target: Role): boolean {
  return assignableRoles(actor).includes(target);
}

/** Role өөрчлөлт: хуучин ба шинэ role хоёулаа үүсгэгчийн хүрээнд байх ёстой (MANAGER → STAFF-ийг дэвшүүлэхгүй) */
export function canAssign(actor: Role, from: Role | null, to: Role): boolean {
  const roles = assignableRoles(actor);
  return roles.includes(to) && (from === null || roles.includes(from));
}

export function canEditSalary(actor: Role): boolean {
  return actor === "ADMIN" || can(actor, "payroll:write");
}
