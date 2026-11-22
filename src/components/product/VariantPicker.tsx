"use client";

import { ShoppingBag } from "lucide-react";
import { useId, useState } from "react";
import { formatMNT } from "@/lib/money";
import type { ProductCardVariant } from "@/server/queries/catalog";

type Props = { productName: string; variants: ProductCardVariant[]; large?: boolean };

export function VariantPicker({ productName, variants, large }: Props) {
  const name = useId();
  const [selectedId, setSelectedId] = useState(() => (variants.find((v) => v.inStock) ?? variants[0])?.id);
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  if (!selected) return null;

  return (
    <div className="mt-auto pt-4">
      {variants.length > 1 && (
        <fieldset className="mb-4">
          <legend className="sr-only">Хэмжээ сонгох</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {variants.map((v) => (
              <label key={v.id} className="text-micro flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name={name}
                  value={v.id}
                  checked={v.id === selected.id}
                  onChange={() => setSelectedId(v.id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="grid size-3.5 place-items-center rounded-full border border-navy peer-checked:[&>span]:bg-navy peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy"
                >
                  <span className="size-2 rounded-full" />
                </span>
                <span className={v.inStock ? "" : "text-muted line-through decoration-1"}>{v.size}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {variants.length === 1 && <p className="text-micro mb-4">{selected.size}</p>}

      <div className="flex h-11 items-center justify-between">
        <p className={large ? "text-[17px]" : "text-[15px]"} aria-live="polite">
          {formatMNT(selected.price)}
        </p>
        {selected.inStock ? (
          <button
            type="button"
            // TODO (Ээлж 5): сагсанд нэмэх
            aria-label={`${productName} ${selected.size} сагсанд нэмэх`}
            className="grid size-11 place-items-center rounded-full bg-navy text-white transition-opacity hover:opacity-85"
          >
            <ShoppingBag className="size-[18px]" strokeWidth={1.25} aria-hidden />
          </button>
        ) : (
          <span className="text-[13px] text-muted">Дууссан</span>
        )}
      </div>
    </div>
  );
}
