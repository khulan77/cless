import { describe, expect, it } from "vitest";
import { inventoryAccess, inventoryVariantSelect, redactCost, stockMovementSelect } from "./visibility";

describe("inventory cost visibility", () => {
  it("MANAGER reads stock but never selects cost", () => {
    expect(inventoryAccess("MANAGER")).toEqual({ canRead: true, canWrite: false, canSeeCost: false });
    expect(inventoryVariantSelect("MANAGER").costPrice).toBe(false);
    expect(stockMovementSelect("MANAGER").unitCost).toBe(false);
  });

  it("ADMIN reads, writes and sees cost", () => {
    expect(inventoryAccess("ADMIN")).toEqual({ canRead: true, canWrite: true, canSeeCost: true });
    expect(inventoryVariantSelect("ADMIN").costPrice).toBe(true);
    expect(stockMovementSelect("ADMIN").unitCost).toBe(true);
  });

  it("STAFF has no inventory access at all", () => {
    expect(inventoryAccess("STAFF")).toEqual({ canRead: false, canWrite: false, canSeeCost: false });
    expect(inventoryVariantSelect("STAFF").costPrice).toBe(false);
  });

  it("redacts cost fields for roles without cost:read", () => {
    const row = { sku: "X", costPrice: 40000, unitCost: 39000 };
    expect(redactCost(row, "MANAGER")).toEqual({ sku: "X", costPrice: null, unitCost: null });
    expect(redactCost(row, "STAFF")).toEqual({ sku: "X", costPrice: null, unitCost: null });
    expect(redactCost(row, "ADMIN")).toEqual(row);
  });

  it("does not add cost keys that were not selected", () => {
    expect(redactCost({ sku: "X" }, "MANAGER")).toEqual({ sku: "X" });
  });
});
