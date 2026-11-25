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
  // Цаг захиалга
  "appointment:read",
  "appointment:write",
  "appointment:status",
  "appointment:done-manual",
  "staff-schedule:write",
  "room:write",
  "service-staff:write",
  // Үйлчлүүлэгчийн утас, имэйл (STAFF-д харагдахгүй)
  "customer:contact:read",
  // Сайтаас ирсэн "Салонд захиалах" хүсэлт
  "inquiry:manage",
  // POS / борлуулалт
  "pos:use",
  "sale:create",
  "sale:read",
  "payment:cash",
  "payment:card",
  "payment:qpay",
  "payment:transfer:confirm",
  "discount:over-limit",
  "sale:refund",
  "sale:void-paid",
  // Үйлчлүүлэгч, айлчлал
  "customer:read",
  "customer:write",
  "visit:write",
  // Үйлчлүүлэгчийн тэмдэглэл, айлчлалын өмнө/дараах зураг. STAFF-д: зөвхөн өөрөө үйлчилсэн
  // үйлчлүүлэгч дээр (service давхаргад шалгана — src/server/modules/customers/access.ts)
  "customer-note:write",
  "visit-photo:read",
  "visit-photo:write",
  // Гоо сайханчийн "Миний самбар" — зөвхөн өөрийн хуваарь, үйлчлүүлэгч, борлуулалт
  "me:read",
  // Кассын ээлж
  "shift:own",
  "shift:all",
  // Агуулах, каталог
  "stock:read",
  "stock:write",
  "product:write",
  "service:write",
  "price:write",
  "cost:read",
  "report:read",
  // Өдрийн тайланг нягтланд имэйлээр илгээх
  "report:send",
  "payroll:write",
  "user:write",
  "settings:write",
  // Интеграцийн нууц тохиргоо (QPay API, Smart Logic, SMS)
  "integration:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Эрхийн тодорхойлолт — role бүр нэг мөр. Шинэ role (жишээ нь ACCOUNTANT) нэмэхэд:
 * schema-ийн Role enum + энд нэг мөр + ROLE_LABELS + permissions.test.ts-ийн хүснэгтэд багана.
 */
const STAFF: readonly Permission[] = ["schedule:own", "me:read", "customer-note:write", "visit-photo:read", "visit-photo:write"];

/** Зөвхөн ADMIN: хэрэглэгч нэмэх/хасах, интеграцийн нууц тохиргоо */
const ADMIN_ONLY: readonly Permission[] = ["user:write", "integration:write"];

/** MANAGER = ADMIN-аас ADMIN_ONLY-г хассан (11/24: менежер бүгдийг харж, засна; 10%-иас дээш хөнгөлөлт ч өгнө) */
const MANAGER: readonly Permission[] = PERMISSIONS.filter((p) => !ADMIN_ONLY.includes(p));

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
  MANAGER: "Ресепшн (менежер)",
  STAFF: "Гоо сайханч",
};

/** Нэвтэрсний дараа очих анхны хуудас */
export function homePathFor(role: Role): string {
  return role === "STAFF" ? "/admin/schedule" : "/admin";
}
