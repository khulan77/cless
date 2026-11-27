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
  // Бүтээгдэхүүний мөрийн "Зарсан" ажилтныг борлуулалтын дараа засах (урамшуулалд нөлөөлнө)
  "sale:seller",
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
  // Үйлчилгээнд бүтээгдэхүүн олгох (SERVICE_USE) — MANAGER, ADMIN (PROMPT 27)
  "stock:issue",
  "product:write",
  "service:write",
  "price:write",
  "cost:read",
  "report:read",
  // Өдрийн тайланг нягтланд имэйлээр илгээх
  "report:send",
  // Менежерийн хэсгийг зөвхөн харах (ACCOUNTANT) — засах товч харагдахгүй, бичих action бүр өөрийн эрхээр хориотой
  "admin:view",
  // Ирц: харах / тэмдэглэх; нийтийн амралтын өдрүүд
  "attendance:read",
  // Ирцийг гараар засах — зөвхөн ADMIN, шалтгаантай (PROMPT 20: ирц бүрэн автомат)
  "attendance:write",
  // Ирцэд тайлбар бичих (цагт нөлөөлөхгүй) — MANAGER, ADMIN
  "attendance:note",
  // Өөрийн ирц: "Ирлээ / Явлаа" (байршлаар, PROMPT 19) — бүх ажилтан
  "attendance:self",
  "holiday:write",
  // Цалин: харах; тооцоолох, засвар, батлах, олгосон, экспорт (банкны данс); хувь хэмжээ
  "payroll:read",
  "payroll:write",
  "payroll:settings",
  // Санхүү (PROMPT 18): зардал харах / бүртгэх; санхүүгийн тайлан (P&L, мөнгөн гүйлгээ, баланс, НӨАТ).
  // MANAGER-т статик эрх үгүй — SiteSetting "finance"-ээр харах эрх нээгдэнэ (finance/access.ts).
  "expense:read",
  "expense:write",
  "finance:read",
  "user:write",
  // MANAGER: зөвхөн гоо сайханч (STAFF) нэмэх/засах/урих (users/policy.ts)
  "user:write:staff",
  "settings:write",
  // Интеграцийн нууц тохиргоо (QPay API, Smart Logic, SMS)
  "integration:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Эрхийн тодорхойлолт — role бүр нэг мөр. Шинэ role (жишээ нь ACCOUNTANT) нэмэхэд:
 * schema-ийн Role enum + энд нэг мөр + ROLE_LABELS + permissions.test.ts-ийн хүснэгтэд багана.
 */
const STAFF: readonly Permission[] = ["schedule:own", "me:read", "customer-note:write", "visit-photo:read", "visit-photo:write", "attendance:self"];

/** Зөвхөн ADMIN: хэрэглэгч нэмэх/хасах, интеграцийн нууц тохиргоо, ирцийн гар засвар (PROMPT 20) */
const ADMIN_ONLY: readonly Permission[] = ["user:write", "integration:write", "attendance:write"];

/** Цалин — ADMIN ба ACCOUNTANT (11/25). Цалингийн мэдээлэл эмзэг тул MANAGER-т үгүй. */
const PAYROLL: readonly Permission[] = ["payroll:read", "payroll:write", "payroll:settings"];

/** Санхүү — ADMIN ба ACCOUNTANT. MANAGER — тохиргоогоор зөвхөн харах (finance/access.ts) */
const FINANCE: readonly Permission[] = ["expense:read", "expense:write", "finance:read"];

/** MANAGER = ADMIN-аас ADMIN_ONLY, цалинг хассан (11/24: менежер бүгдийг харж, засна; 10%-иас дээш хөнгөлөлт ч өгнө) */
const MANAGER: readonly Permission[] = PERMISSIONS.filter((p) => !ADMIN_ONLY.includes(p) && !PAYROLL.includes(p) && !FINANCE.includes(p));

/**
 * ACCOUNTANT (11/25): менежерийн харж буй бүх хэсгийг зөвхөн харна + цалин бүрэн + "Нягтланд илгээх".
 * 11/26–27 (PROMPT 20, 23): каталог — бараа + үйлчилгээ + үнэ + үлдэгдэл бичнэ; санхүү, зардал. POS / борлуулалт — үгүй.
 * Айлчлалын зураг (visit-photo:*) — эрүүл мэндийн хувийн мэдээлэл тул үгүй. Бичих эрх (…:write, pos:use, shift:*) үгүй.
 */
const ACCOUNTANT: readonly Permission[] = [
  "schedule:all",
  "appointment:read",
  "customer:read",
  "customer:contact:read",
  "sale:read",
  "stock:read",
  // PROMPT 20/23: нягтлан каталогийг бүртгэнэ — бараа, үйлчилгээ (нэр, хугацаа, үнэ, зураг, ангилал), үнэ,
  // үлдэгдэл (нэг каталог — POS, календарь, сайт шууд харна). Үйлчилгээг хэн хийх (service-staff:write) — менежер.
  "stock:write",
  "product:write",
  "service:write",
  "price:write",
  "cost:read",
  "report:read",
  "report:send",
  "admin:view",
  "attendance:read",
  "attendance:self",
  "holiday:write",
  ...PAYROLL,
  ...FINANCE,
];

const ADMIN: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  STAFF: new Set(STAFF),
  MANAGER: new Set(MANAGER),
  ACCOUNTANT: new Set(ACCOUNTANT),
  ADMIN: new Set(ADMIN),
};

/** Зөвхөн харах горим: менежерийн хуудсыг харна, гэхдээ тухайн хэсгийн бичих эрхгүй (ACCOUNTANT) */
export function isReadOnly(role: Role | null | undefined): boolean {
  return can(role, "admin:view") && !can(role, "appointment:write");
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Админ",
  MANAGER: "Ресепшн (менежер)",
  ACCOUNTANT: "Нягтлан",
  STAFF: "Гоо сайханч",
};

/** Нэвтэрсний дараа очих анхны хуудас */
export function homePathFor(role: Role): string {
  if (role === "STAFF") return "/admin/schedule";
  // PROMPT 18: нягтлангийн нүүр — санхүүгийн тайлан
  if (role === "ACCOUNTANT") return "/admin/finance";
  return "/admin";
}
