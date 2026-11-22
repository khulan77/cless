/**
 * Үлдэгдлийн хуудсанд хэн юуг харахыг тодорхойлно. Өртөг (costPrice, unitCost)-ийг
 * `cost:read` эрхгүй хэрэглэгчид DB-ээс огт уншихгүй — client руу хэзээ ч очихгүй.
 * Цэвэр функц тул unit test хийгдэнэ.
 */
import type { Role } from "@/generated/prisma/enums";
import { can } from "@/server/auth/permissions";

export function inventoryAccess(role: Role) {
  return {
    canRead: can(role, "stock:read"),
    canWrite: can(role, "stock:write"),
    canSeeCost: can(role, "cost:read"),
  };
}

export function inventoryVariantSelect(role: Role) {
  return {
    id: true,
    sku: true,
    size: true,
    stock: true,
    reserved: true,
    lowStockAt: true,
    isActive: true,
    costPrice: inventoryAccess(role).canSeeCost,
    product: { select: { id: true, name: true } },
  } as const;
}

export function stockMovementSelect(role: Role) {
  return {
    id: true,
    type: true,
    qty: true,
    note: true,
    createdAt: true,
    unitCost: inventoryAccess(role).canSeeCost,
    createdBy: { select: { name: true } },
    sale: { select: { number: true } },
  } as const;
}

/** Өртгийг эрхгүй бол null болгож баталгаажуулна (select-ийн араас хоёр дахь хамгаалалт) */
export function redactCost<T extends object>(row: T, role: Role): T {
  if (inventoryAccess(role).canSeeCost) return row;
  const copy = { ...row } as Record<string, unknown>;
  if ("costPrice" in copy) copy.costPrice = null;
  if ("unitCost" in copy) copy.unitCost = null;
  return copy as T;
}
