/**
 * reset-catalog: demo каталог + гүйлгээ → цэвэрлэх → бүтээгдэхүүн 0, ангилал (14) ба үйлчилгээ хэвээр.
 */
import pg from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { checkout } from "@/server/modules/sales/service";
import { makeCustomer, makeService, makeUser, makeVariant, resetDb } from "../tests/db-helpers";
import { launchedAt, resetCatalog } from "./lib/reset-sql";

beforeEach(resetDb);

async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await c.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}

describe("reset-catalog", () => {
  it("removes products and everything holding them; keeps collections, services, customers, appointments", async () => {
    const manager = await makeUser("MANAGER");
    const staff = await makeUser("STAFF");
    // 14 ангилал (шаталсан)
    const face = await db.collection.create({ data: { slug: "face", name: "Нүүрний арчилгаа", kind: "CATEGORY" } });
    for (let i = 1; i < 14; i++) await db.collection.create({ data: { slug: `c${i}`, name: `Ангилал ${i}`, kind: "CATEGORY", parentId: i < 6 ? face.id : null } });

    const serum = await makeVariant({ price: 180_000, stock: 5, cost: 90_000 });
    const cream = await makeVariant({ price: 120_000, stock: 3 });
    await db.productImage.create({ data: { productId: serum.productId, url: "https://x.supabase.co/storage/v1/object/public/p/a.webp", alt: "a" } });
    await db.productCollection.create({ data: { productId: serum.productId, collectionId: face.id } });
    await db.productRelation.create({ data: { productId: serum.productId, relatedId: cream.productId, type: "SIMILAR" } });
    const branch = await db.branch.findFirstOrThrow({ where: { code: "CL" } });
    await db.stockMovement.create({ data: { variantId: serum.id, branchId: branch.id, qty: 5, type: "PURCHASE", createdById: manager.id } });
    await db.bundleItem.create({ data: { bundleProductId: cream.productId, variantId: serum.id, qty: 1 } });
    const facial = await makeService({ price: 250_000, consumables: [{ variantId: serum.id, qty: 1 }] });
    const customer = await makeCustomer();
    await db.appointment.create({
      data: { customerId: customer.id, serviceId: facial.id, staffId: staff.id, startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000), blockedUntil: new Date(Date.now() + 90_000_000), branchId: branch.id },
    });
    // Борлуулалт (SaleItem → Variant Restrict)
    await checkout({ items: [{ kind: "PRODUCT", variantId: serum.id, qty: 1 }], customerId: customer.id }, { id: manager.id, role: manager.role });

    expect(await withClient(launchedAt)).toBeNull();
    const r = await withClient((c) => resetCatalog(c, { target: "test" }));

    expect(r.imagesLeftInStorage).toBe(1);
    expect(r.deleted.find((d) => d.label === "Бүтээгдэхүүн")!.count).toBe(2);
    expect(await db.product.count()).toBe(0);
    expect(await db.variant.count()).toBe(0);
    expect(await db.productCollection.count()).toBe(0);
    expect(await db.sale.count()).toBe(0);
    expect(await db.stockMovement.count()).toBe(0);
    expect(await db.serviceConsumable.count()).toBe(0);
    expect(await db.collection.count()).toBe(14);
    expect(await db.service.count()).toBe(1);
    expect(await db.customer.count()).toBe(1);
    expect(await db.appointment.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: "catalog.reset" } })).toBe(1);
  });

  it("is atomic: a failure rolls everything back", async () => {
    await makeVariant({ price: 1, stock: 0 });
    await expect(
      withClient(async (c) => {
        await resetCatalog(c, { target: "test" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db.product.count()).toBe(1);
  });
});
