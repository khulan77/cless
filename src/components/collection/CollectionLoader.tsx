"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { t } from "@/i18n";
import { mergeCells } from "@/lib/grid-cells";
import { loadCollectionProducts } from "@/server/actions/catalog";
import type { CollectionGridTile, ProductCardData } from "@/server/queries/catalog";
import { GridTile } from "./GridTile";

type Ctx = {
  appended: ProductCardData[];
  shown: number;
  total: number;
  pending: boolean;
  loadMore: () => void;
  initialCount: number;
  tiles: CollectionGridTile[];
  stepped: boolean;
};

const LoaderContext = createContext<Ctx | null>(null);

function useLoader() {
  const ctx = useContext(LoaderContext);
  if (!ctx) throw new Error("CollectionLoader missing");
  return ctx;
}

type Props = {
  slug: string;
  total: number;
  initialCount: number;
  pageSize: number;
  tiles: CollectionGridTile[];
  /** CONCERN collections show "STEP n" on cards */
  stepped: boolean;
  children: ReactNode;
};

/** Keeps server-rendered cells and appends further pages client-side. */
export function CollectionLoader({ slug, total, initialCount, pageSize, tiles, stepped, children }: Props) {
  const [appended, setAppended] = useState<ProductCardData[]>([]);
  const [pending, startTransition] = useTransition();
  const shown = initialCount + appended.length;

  const loadMore = () =>
    startTransition(async () => {
      const next = await loadCollectionProducts(slug, shown);
      setAppended((prev) => [...prev, ...next]);
      const page = Math.ceil((shown + next.length) / pageSize);
      const url = new URL(window.location.href);
      if (page > 1) url.searchParams.set("page", String(page));
      window.history.replaceState(window.history.state, "", url);
    });

  return (
    <LoaderContext.Provider value={{ appended, shown, total, pending, loadMore, initialCount, tiles, stepped }}>
      {children}
    </LoaderContext.Provider>
  );
}

/** Cells for products loaded after the initial server render */
export function LoadedCells() {
  const { appended, initialCount, tiles, stepped, total } = useLoader();
  if (appended.length === 0) return null;
  const shown = initialCount + appended.length;
  const initialCells = mergeCells(initialCount, tiles, initialCount >= total).length;
  const cells = mergeCells(shown, tiles, shown >= total).slice(initialCells);
  return cells.map((cell) => {
    if (cell.type === "tile") {
      return (
        <li key={`tile-${cell.tile.id}`}>
          <GridTile tile={cell.tile} />
        </li>
      );
    }
    const product = appended[cell.index - initialCount];
    if (!product) return null;
    return (
      <li key={product.id}>
        <ProductCard product={product} step={stepped ? cell.index + 1 : undefined} />
      </li>
    );
  });
}

export function LoadMoreBar() {
  const { shown, total, pending, loadMore } = useLoader();
  if (total === 0) return null;
  return (
    <div className="mt-12 flex flex-col items-center gap-4">
      <p className="text-meta text-muted" aria-live="polite">
        {t.collection.progress(shown, total)}
      </p>
      <div aria-hidden className="h-px w-48 bg-navy/15">
        <div className="h-full bg-navy transition-[width] duration-300" style={{ width: `${(shown / total) * 100}%` }} />
      </div>
      {shown < total && (
        <button
          type="button"
          onClick={loadMore}
          disabled={pending}
          aria-busy={pending}
          className="rounded-full border border-navy px-6 py-2.5 text-button transition-colors hover:bg-navy hover:text-white disabled:opacity-60"
        >
          {pending ? t.common.loading : t.collection.loadMore}
        </button>
      )}
    </div>
  );
}
