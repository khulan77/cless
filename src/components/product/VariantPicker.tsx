"use client";

import { ShoppingBag } from "lucide-react";
import { useId, useState } from "react";
import { useCatalogMode } from "@/components/salon/StorefrontContext";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import type { CardVariant } from "@/server/queries/catalog";

type Props = {
  variants: CardVariant[];
  /** Bundles have no size radios */
  hideSizes?: boolean;
  /** Kept for callers; cards and quick view now share one price size (text-price) */
  large?: boolean;
  /** Controlled selection (product page) */
  value?: string;
  onChange?: (id: string) => void;
};

export function defaultVariantId(variants: CardVariant[]) {
  return (variants.find((v) => v.available) ?? variants[0])?.id;
}

/** Size radios — sold-out sizes are struck through diagonally and not selectable */
export function SizeOptions({
  variants,
  selectedId,
  onSelect,
  pill,
}: {
  variants: CardVariant[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  pill?: boolean;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={t.product.size} className={`flex flex-wrap ${pill ? "gap-2" : "gap-x-4 gap-y-2"}`}>
      {variants.map((v) => {
        const checked = v.id === selectedId;
        const soldOut = !v.available;
        return (
          <label
            key={v.id}
            title={soldOut ? t.product.variantSoldOut : undefined}
            className={`text-micro relative inline-flex items-center gap-1.5 before:absolute before:inset-x-0 before:content-[''] ${pill ? "before:-inset-y-1.5" : "before:-inset-y-4"} ${soldOut ? "cursor-not-allowed text-muted" : "cursor-pointer"} ${
              pill
                ? `h-9 rounded-full border px-4 ${checked ? "border-navy" : "border-line"} ${soldOut ? "size-soldout" : ""}`
                : ""
            }`}
          >
            <input
              type="radio"
              name={name}
              value={v.id}
              checked={checked}
              disabled={soldOut}
              onChange={() => onSelect(v.id)}
              className="peer sr-only"
              aria-describedby={soldOut ? `${name}-${v.id}-so` : undefined}
            />
            {!pill && (
              <span
                aria-hidden
                className="grid size-3.5 place-items-center rounded-full border border-current peer-checked:[&>span]:bg-navy peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2"
              >
                <span className="size-2 rounded-full" />
              </span>
            )}
            <span className={`relative ${soldOut && !pill ? "size-soldout px-0.5" : ""}`}>{v.size}</span>
            {soldOut && (
              <span id={`${name}-${v.id}-so`} className="sr-only">
                {t.product.variantSoldOut}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

export function CartButton({ label = t.product.addToCart }: { label?: string }) {
  return (
    <button
      type="button"
      // TODO (cart round): add to cart
      aria-label={label}
      data-br="card.addToCart"
      // BR: 34px round button; ::before keeps a 44px hit area
      className="relative grid size-[34px] shrink-0 place-items-center rounded-full bg-navy text-white transition-opacity before:absolute before:-inset-[5px] before:content-[''] hover:opacity-85"
    >
      <ShoppingBag className="size-[18px]" strokeWidth={1.25} aria-hidden />
    </button>
  );
}

/** Card and quick view: size → price → cart */
export function VariantPicker({ variants, hideSizes, value, onChange }: Props) {
  const [internal, setInternal] = useState(() => defaultVariantId(variants));
  const selectedId = value ?? internal;
  const select = (id: string) => (onChange ? onChange(id) : setInternal(id));
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const catalog = useCatalogMode();
  if (!selected) return null;
  const allSoldOut = variants.every((v) => !v.available);

  return (
    <div className="mt-auto pt-4">
      {!hideSizes && variants.length > 1 && (
        <div className="mb-3">
          <SizeOptions variants={variants} selectedId={selected.id} onSelect={select} />
        </div>
      )}
      {!hideSizes && variants.length === 1 && <p className="text-micro mb-3">{selected.size}</p>}

      <div className="flex min-h-[34px] items-center justify-between gap-3">
        <div>
          <p data-br="card.priceText" className="text-price" aria-live="polite">
            {formatMNT(selected.price)}
          </p>
          {!catalog && selected.lowStock && <p className="text-note text-muted">{t.product.lowStock}</p>}
          {catalog && (
            <p className={`text-note ${selected.available ? "" : "text-muted"}`}>
              {!selected.available ? t.stock.soldOut : selected.lowStock ? t.stock.low : t.stock.inSalon}
            </p>
          )}
        </div>
        {catalog ? null : allSoldOut || !selected.available ? (
          <span className="text-meta text-muted">{t.product.soldOut}</span>
        ) : (
          <CartButton />
        )}
      </div>
    </div>
  );
}
