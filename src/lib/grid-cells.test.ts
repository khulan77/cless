import { describe, expect, it } from "vitest";
import { mergeCells } from "./grid-cells";

describe("mergeCells", () => {
  it("places a tile at its 1-based position", () => {
    const cells = mergeCells(10, [{ position: 3 }]);
    expect(cells).toHaveLength(11);
    expect(cells[2]).toEqual({ type: "tile", tile: { position: 3 } });
    expect(cells.filter((c) => c.type === "product").map((c) => (c.type === "product" ? c.index : -1))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("holds back tiles beyond loaded products until complete", () => {
    expect(mergeCells(5, [{ position: 8 }]).some((c) => c.type === "tile")).toBe(false);
    const done = mergeCells(5, [{ position: 8 }], true);
    expect(done).toHaveLength(6);
    expect(done[5]).toEqual({ type: "tile", tile: { position: 8 } });
  });

  it("appends the tile right after the last product (serum: 7 products, tile 8)", () => {
    const cells = mergeCells(7, [{ position: 8 }], true);
    expect(cells.map((c) => c.type)).toEqual([...Array(7).fill("product"), "tile"]);
  });

  it("is stable when more products load (prefix unchanged)", () => {
    const tiles = [{ position: 8 }, { position: 30 }];
    const a = mergeCells(24, tiles);
    const b = mergeCells(48, tiles);
    expect(b.slice(0, a.length)).toEqual(a);
  });
});
