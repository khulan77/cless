import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { makeUser, resetDb } from "../../../../tests/db-helpers";

// Server Action-уудыг Next-ээс гадуур дуудна: session ба кэшийг mock хийнэ
const session = vi.hoisted(() => ({ user: null as null | { id: string; name: string; email: string; role: "ADMIN"; isActive: true } }));
vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/server/auth/session", () => ({
  requirePermission: vi.fn(async () => session.user),
  requireAnyPermission: vi.fn(async () => session.user),
  getCurrentUser: vi.fn(async () => session.user),
}));
const stored = vi.hoisted(() => [] as string[]);
vi.mock("@/server/storage", async (orig) => ({
  ...(await orig<typeof import("@/server/storage")>()),
  storage: {
    put: vi.fn(async (f: File) => {
      const url = `/uploads/products/test-${stored.length}.${f.type.split("/")[1]}`;
      stored.push(url);
      return { url };
    }),
    remove: vi.fn(async () => undefined),
  },
}));

const { parseWorkbook } = await import("./parse");
const { executeImport, planImport } = await import("./service");
const { makeXlsx, product, variant } = await import("./test-helpers");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const fakeFetch = vi.fn(async (url: string) => {
  if (url.includes("broken")) throw new (await import("./images")).ImageFetchError("сервер 404 буцаалаа");
  return new File([PNG], "x.png", { type: "image/png" });
});

async function counts() {
  const [products, variants, movements, prices, audits, images] = await Promise.all([
    db.product.count(),
    db.variant.count(),
    db.stockMovement.count(),
    db.priceHistory.count(),
    db.auditLog.count(),
    db.productImage.count(),
  ]);
  return { products, variants, movements, prices, audits, images };
}

async function workbook() {
  return parseWorkbook(
    await makeXlsx(
      [
        product("masque-vivant", { categories: "masks", concerns: "acne", isPublished: "тийм", images: "https://cdn.test/a.png; https://cdn.test/broken.png" }),
        product("serum-c", { badge: "ШИНЭ" }),
      ],
      [
        variant("masque-vivant", "MV-50", { price: 185000, costPrice: 92000, initialStock: 12 }),
        variant("masque-vivant", "MV-100", { size: "100 мл", price: 320000, costPrice: 160000 }),
        variant("serum-c", "SC-30", { price: 240000, costPrice: 120000, initialStock: 6 }),
      ],
    ),
  );
}

beforeAll(async () => {
  await resetDb();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb();
  stored.length = 0;
  fakeFetch.mockClear();
  const admin = await makeUser("ADMIN");
  session.user = { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN", isActive: true };
  await db.collection.createMany({
    data: [
      { slug: "masks", name: "Маск", kind: "CATEGORY" },
      { slug: "acne", name: "Батга", kind: "CONCERN" },
    ],
  });
});

describe("Excel импорт (DB)", () => {
  it("урьдчилан харах нь DB-д юу ч бичихгүй", async () => {
    const before = await counts();
    const plan = await planImport(await workbook());
    expect(plan.summary).toEqual({ create: 2, update: 0, unchanged: 0, error: 0 });
    expect(await counts()).toEqual(before);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("импорт: бүтээгдэхүүн, PriceHistory, AuditLog, PURCHASE movement (өртөгтэй)", async () => {
    const report = await executeImport(await planImport(await workbook()), { fetchImage: fakeFetch as never });
    expect(report).toMatchObject({ created: 2, updated: 0, failed: 0, stockReceived: 2, imagesDownloaded: 1 });
    expect(report.warnings.join()).toContain("broken.png");

    const mv = await db.product.findUniqueOrThrow({
      where: { slug: "masque-vivant" },
      include: { variants: { orderBy: { sortOrder: "asc" } }, images: true, collections: true },
    });
    expect(mv.isPublished).toBe(true);
    expect(mv.collections).toHaveLength(2);
    expect(mv.images.map((i) => i.url)).toEqual(["/uploads/products/test-0.png"]);
    expect(mv.variants.map((v) => [v.sku, v.price, v.costPrice, v.stock])).toEqual([
      ["MV-50", 185000, 92000, 12],
      ["MV-100", 320000, 160000, 0],
    ]);
    const moves = await db.stockMovement.findMany({ where: { variantId: mv.variants[0]!.id } });
    expect(moves).toMatchObject([{ type: "PURCHASE", qty: 12, unitCost: 92000 }]);
    expect(await db.priceHistory.count()).toBe(3);
    expect(await db.auditLog.count({ where: { action: "product.create" } })).toBe(2);
    expect(await db.auditLog.count({ where: { action: "stock.purchase" } })).toBe(2);
  });

  it("давтан импорт idempotent: өөрчлөлтгүй, шинэ мөр үүсэхгүй", async () => {
    await executeImport(await planImport(await workbook()), { fetchImage: fakeFetch as never });
    const after1 = await counts();
    const plan2 = await planImport(await workbook());
    expect(plan2.summary).toEqual({ create: 0, update: 0, unchanged: 2, error: 0 });
    expect(plan2.canImport).toBe(false);
    const report = await executeImport(plan2, { fetchImage: fakeFetch as never });
    expect(report).toMatchObject({ created: 0, updated: 0, unchanged: 2, stockReceived: 0 });
    expect(await counts()).toEqual(after1);
  });

  it("үнэ шинэчлэх: PriceHistory нэмэгдэнэ, байгаа үлдэгдэлд хүрэхгүй, Excel-д байхгүй хувилбар хэвээр", async () => {
    await executeImport(await planImport(await workbook()), { fetchImage: fakeFetch as never });
    const parsed = await parseWorkbook(
      await makeXlsx([product("masque-vivant")], [variant("masque-vivant", "MV-50", { price: 199000, initialStock: 99 })]),
    );
    const plan = await planImport(parsed);
    expect(plan.products[0]!.action).toBe("update");
    const report = await executeImport(plan, { fetchImage: fakeFetch as never });
    expect(report).toMatchObject({ updated: 1, stockReceived: 0 });

    const vs = await db.variant.findMany({ where: { product: { slug: "masque-vivant" } }, orderBy: { sortOrder: "asc" } });
    expect(vs.map((v) => [v.sku, v.price, v.costPrice, v.stock, v.isActive])).toEqual([
      ["MV-50", 199000, 92000, 12, true],
      ["MV-100", 320000, 160000, 0, true],
    ]);
    expect(await db.priceHistory.count({ where: { variantId: vs[0]!.id } })).toBe(2);
    expect(await db.stockMovement.count({ where: { variantId: vs[0]!.id } })).toBe(1);
    // Зураг байсан тул дахин татахгүй, ангилал хэвээр
    const p = await db.product.findUniqueOrThrow({ where: { slug: "masque-vivant" }, include: { images: true, collections: true } });
    expect(p.images).toHaveLength(1);
    expect(p.collections).toHaveLength(2);
    expect(p.isPublished).toBe(true);
  });

  it("алдаатай мөр байвал canImport=false", async () => {
    const parsed = await parseWorkbook(await makeXlsx([product("a", { categories: "serums" })], [variant("a", "A-1")]));
    const plan = await planImport(parsed);
    expect(plan.canImport).toBe(false);
    expect(plan.products[0]!.errors.join()).toContain("ангилал «serums» олдсонгүй");
  });
});
