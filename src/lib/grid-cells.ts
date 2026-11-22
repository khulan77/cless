/**
 * Merges products and editorial tiles into grid cells. A tile with position p
 * occupies the p-th cell (1-based); products fill the remaining cells in order.
 * Tiles positioned past the last product are appended only once every product
 * is loaded (`complete`), so they never jump ahead of unloaded pages.
 */
export type GridCell<T> = { type: "product"; index: number } | { type: "tile"; tile: T };

export function mergeCells<T extends { position: number }>(productCount: number, tiles: T[], complete = false): GridCell<T>[] {
  const byPos = new Map(tiles.map((t) => [t.position, t]));
  const cells: GridCell<T>[] = [];
  let product = 0;
  let cell = 1;
  for (; product < productCount; cell++) {
    const tile = byPos.get(cell);
    if (tile) cells.push({ type: "tile", tile });
    else cells.push({ type: "product", index: product++ });
  }
  if (complete) {
    for (const tile of [...tiles].sort((a, b) => a.position - b.position)) {
      if (tile.position >= cell) cells.push({ type: "tile", tile });
    }
  }
  return cells;
}
