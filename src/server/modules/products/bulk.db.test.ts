import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { checkout } from "@/server/modules/sales/service";
import { makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { bulkArchiveProducts, bulkDeleteMessage, bulkDeleteProducts } from "./bulk";

let manager: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  manager = await makeUser("MANAGER");
});

describe("bulk products", () => {
  it("archive hides from the site and keeps rows", async () => {
    const a = await makeVariant({ price: 1, stock: 0 });
    const b = await makeVariant({ price: 1, stock: 0 });
    const r = await bulkArchiveProducts([a.productId, b.productId], manager.id);
    expect(r.archived).toBe(2);
    expect(await db.product.count({ where: { isPublished: true } })).toBe(0);
    expect(await db.product.count()).toBe(2);
    expect(await db.auditLog.count({ where: { action: "product.archive" } })).toBe(2);
  });

  it("delete removes products without history; archives the ones with sales / stock movements", async () => {
    const clean = await makeVariant({ price: 1, stock: 0, name: "CLEAN" });
    await db.productImage.create({ data: { productId: clean.productId, url: "https://x/y.webp", alt: "y" } });
    const sold = await makeVariant({ price: 10_000, stock: 2, name: "SOLD" });
    await checkout({ items: [{ kind: "PRODUCT", variantId: sold.id, qty: 1 }] }, { id: manager.id, role: manager.role });
    const moved = await makeVariant({ price: 1, stock: 0, name: "MOVED" });
    const branch = await db.branch.findFirstOrThrow({ where: { code: "CL" } });
    await db.stockMovement.create({ data: { variantId: moved.id, branchId: branch.id, qty: 3, type: "PURCHASE", createdById: manager.id } });

    const r = await bulkDeleteProducts([clean.productId, sold.productId, moved.productId], manager.id);
    expect(r).toMatchObject({ deleted: 1, archived: 2, removedImageUrls: ["https://x/y.webp"] });
    expect(bulkDeleteMessage(r)).toBe("1-ийг устгав, 2 нь гүйлгээтэй тул архивлагдлаа.");
    expect(await db.product.findUnique({ where: { id: clean.productId } })).toBeNull();
    expect(await db.product.findMany({ select: { name: true, isPublished: true }, orderBy: { name: "asc" } })).toEqual([
      { name: "MOVED", isPublished: false },
      { name: "SOLD", isPublished: false },
    ]);
    expect(await db.auditLog.count({ where: { action: "product.delete" } })).toBe(1);
  });
});
