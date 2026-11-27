/**
 * PROMPT 20: нягтлан бараа бүртгэнэ (нэг каталог — POS-д шууд), POS/борлуулалт хийхгүй; ирц — менежер засахгүй,
 * админ зөвхөн шалтгаантай; кассын ээлж анхдагчаар унтраалттай (бэлэн төлбөр ээлжгүй, 2 менежер зэрэг).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import { can, type Permission } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";
import { createPayment } from "@/server/modules/payments/service";
import { checkout } from "@/server/modules/sales/service";
import { searchPosCatalog } from "@/server/modules/sales/queries";
import { makeUser, makeVariant, resetDb } from "../../../tests/db-helpers";

let current: { id: string; role: Role } | null = null;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/auth/session", () => {
  const need = (ok: boolean) => {
    if (!current) throw new UnauthorizedError();
    if (!ok) throw new ForbiddenError();
    return { ...current, name: "x", email: "x", isActive: true };
  };
  return {
    requirePermission: async (p: Permission) => need(Boolean(current && can(current.role, p))),
    requireAnyPermission: async (...ps: Permission[]) => need(Boolean(current && ps.some((p) => can(current!.role, p)))),
  };
});
const { saveProduct } = await import("./products");
const { posCheckout } = await import("./pos");
const { setWorkDayAction } = await import("./payroll");

beforeEach(async () => {
  await resetDb();
  current = null;
});

const product = (sku: string) => ({
  name: "НЯГТЛАНГИЙН ТОНИК",
  slug: "nyagtlan-tonik",
  kind: "SINGLE" as const,
  tagline: null,
  recommendedFor: null,
  benefits: [],
  description: "Тайлбар",
  skinScience: null,
  howToUse: [],
  ingredients: null,
  environmental: [],
  clinicalNotes: [],
  seoTitle: null,
  seoDescription: null,
  badge: null,
  isPublished: true,
  sortOrder: 0,
  collectionIds: [],
  images: [],
  variants: [{ sku, barcode: null, size: "100 мл", price: 95_000, costPrice: 40_000, lowStockAt: 3, isActive: true, initialStock: 12 }],
  relations: [],
  bundleItems: [],
});

describe("нягтлан — каталог", () => {
  it("ACCOUNTANT бүтээгдэхүүн үүсгэнэ → MANAGER-ийн POS хайлтад шууд гарна; ACCOUNTANT борлуулалт хийхгүй", async () => {
    const acc = await makeUser("ACCOUNTANT");
    await makeUser("MANAGER");
    current = { id: acc.id, role: "ACCOUNTANT" };
    const r = await saveProduct(product("ACC-TONIK-1"));
    expect(r.ok).toBe(true);
    const hits = await searchPosCatalog("ТОНИК");
    expect(JSON.stringify(hits)).toContain("ACC-TONIK-1");
    const v = await db.variant.findUniqueOrThrow({ where: { sku: "ACC-TONIK-1" } });
    // PROMPT 27: эхний үлдэгдэл → орлого (PURCHASE)
    expect(v.stock).toBe(12);
    expect(await db.stockMovement.findFirstOrThrow({ where: { variantId: v.id } })).toMatchObject({ type: "PURCHASE", qty: 12, unitCost: 40_000, note: "Эхний үлдэгдэл" });
    const sale = await posCheckout({ cart: { items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] } });
    expect(sale.ok).toBe(false);
    expect(await db.sale.count()).toBe(0);
  });
});

describe("ирц — бүрэн автомат", () => {
  it("MANAGER засвар → 403; ADMIN шалтгаангүй → алдаа; шалтгаантай → OK (гараар засагдсан)", async () => {
    const staff = await makeUser("STAFF");
    const manager = await makeUser("MANAGER");
    const admin = await makeUser("ADMIN");
    const input = { staffId: staff.id, date: "2026-11-24", status: "WORKED" as const, hours: 8 };
    current = { id: manager.id, role: "MANAGER" };
    expect(await setWorkDayAction({ ...input, note: "Утас эвдэрсэн" })).toMatchObject({ ok: false, status: 403 });
    current = { id: admin.id, role: "ADMIN" };
    expect((await setWorkDayAction({ ...input, note: "" })).ok).toBe(false);
    expect((await setWorkDayAction({ ...input, note: "Утас эвдэрсэн" })).ok).toBe(true);
    expect(await db.workDay.findFirstOrThrow()).toMatchObject({ fromEvents: false, note: "Утас эвдэрсэн", hours: 8 });
    expect(await db.auditLog.count({ where: { action: "attendance.manual_edit" } })).toBe(1);
  });
});

describe("кассын ээлж — анхдагчаар унтраалттай", () => {
  it("ээлжгүй бэлэн төлбөр OK (CashMovement-гүй); 2 менежер зэрэг → өөр дугаар, өөр бичсэн хүн", async () => {
    const m1 = await makeUser("MANAGER");
    const m2 = await makeUser("MANAGER");
    const a = await makeVariant({ price: 10_000, stock: 5 });
    const b = await makeVariant({ price: 20_000, stock: 5 });
    const [s1, s2] = await Promise.all([
      checkout({ items: [{ kind: "PRODUCT", variantId: a.id, qty: 1 }] }, { id: m1.id, role: "MANAGER" }),
      checkout({ items: [{ kind: "PRODUCT", variantId: b.id, qty: 1 }] }, { id: m2.id, role: "MANAGER" }),
    ]);
    expect(s1.number).not.toBe(s2.number);
    const sales = await db.sale.findMany({ select: { number: true, createdById: true } });
    expect(new Set(sales.map((s) => s.createdById))).toEqual(new Set([m1.id, m2.id]));

    const pay = await createPayment({ saleId: s1.saleId, method: "CASH", amount: s1.total, tendered: s1.total, idempotencyKey: crypto.randomUUID() }, { id: m1.id, role: "MANAGER" });
    expect(pay.payment.status).toBe("SUCCEEDED");
    expect((await db.payment.findFirstOrThrow({ where: { saleId: s1.saleId } })).cashShiftId).toBeNull();
    expect(await db.cashMovement.count()).toBe(0);
    expect(await db.cashShift.count()).toBe(0);
  });
});
