/**
 * Эрхийн цорын ганц эх сурвалж. UI-д нуух нь хангалтгүй — server талд
 * `requirePermission()`-аар заавал шалгана (src/server/auth/session.ts).
 *
 * Энэ файл цэвэр (DB/Next-гүй) тул unit test хийгдэнэ.
 */
import type { Role } from "@/generated/prisma/enums";

export const PERMISSIONS = [
  "schedule:own",
  "schedule:all",
  "appointment:write",
  "visit:write",
  "sale:write",
  "stock:read",
  "stock:write",
  "product:write",
  "service:write",
  "price:write",
  "cost:read",
  "report:read",
  "payroll:write",
  "user:write",
  "settings:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STAFF: readonly Permission[] = ["schedule:own"];

const MANAGER: readonly Permission[] = [
  ...STAFF,
  "schedule:all",
  "appointment:write",
  "visit:write",
  "sale:write",
  "stock:read",
];

const ADMIN: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  STAFF: new Set(STAFF),
  MANAGER: new Set(MANAGER),
  ADMIN: new Set(ADMIN),
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Админ",
  MANAGER: "Менежер",
  STAFF: "Ажилтан",
};

/** Нэвтэрсний дараа очих анхны хуудас */
export function homePathFor(role: Role): string {
  return role === "STAFF" ? "/admin/schedule" : "/admin";
}
