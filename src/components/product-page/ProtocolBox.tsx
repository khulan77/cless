"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SizeOptions, defaultVariantId } from "@/components/product/VariantPicker";
import { useCatalogMode } from "@/components/salon/StorefrontContext";
import { Img } from "@/components/ui/Img";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import type { ProductCardData } from "@/server/queries/catalog";

function ProtocolItem({ product }: { product: ProductCardData }) {
  const [selectedId, setSelectedId] = useState(() => defaultVariantId(product.variants));
  const catalog = useCatalogMode();
  const selected = product.variants.find((v) => v.id === selectedId) ?? product.variants[0];
  const img = product.images[0];
  return (
    <div className="flex gap-4">
      <Link href={`/products/${product.slug}`} className="relative size-24 shrink-0 bg-white">
        {img && <Img src={img.src} alt={img.alt || t.product.image(product.name)} fill sizes="96px" className="object-contain p-1" />}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/products/${product.slug}`} className="text-product block text-[14px] hover:underline">
          {product.name}
        </Link>
        {selected && <p className="mt-1 text-[13px]">{formatMNT(selected.price)}</p>}
        {product.kind !== "BUNDLE" && product.variants.length > 1 && (
          <div className="mt-2">
            <SizeOptions variants={product.variants} selectedId={selected?.id} onSelect={setSelectedId} />
          </div>
        )}
        {catalog ? (
          selected && <p className="mt-2 text-[13px] text-muted">{!selected.available ? t.stock.soldOut : selected.lowStock ? t.stock.low : t.stock.inSalon}</p>
        ) : selected?.available ? (
          // TODO (checkout phase): add to cart
          <button type="button" className="link-underline relative mt-2 text-[13px] before:absolute before:-inset-y-3 before:inset-x-0 before:content-['']">
            {t.product.addToCart}
          </button>
        ) : (
          <p className="mt-2 text-[13px] text-muted">{t.product.soldOut}</p>
        )}
      </div>
    </div>
  );
}

/** Protocol box: one related product at a time + a drawer with the whole routine */
export function ProtocolBox({ items }: { items: ProductCardData[] }) {
  const [index, setIndex] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return;
    if (drawer && !el.open) el.showModal();
    if (!drawer && el.open) el.close();
  }, [drawer]);

  if (items.length === 0) return null;
  const current = items[index]!;

  return (
    <section aria-label={t.product.protocol} className="mt-8">
      <div className="bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-micro">{t.product.protocol}</h2>
          {items.length > 1 && (
            <div className="flex gap-1">
              <button type="button" onClick={() => setIndex((index - 1 + items.length) % items.length)} aria-label={t.product.protocolPrev} className="grid size-11 place-items-center rounded-full hover:bg-white">
                <ChevronLeft className="size-4" strokeWidth={1.25} aria-hidden />
              </button>
              <button type="button" onClick={() => setIndex((index + 1) % items.length)} aria-label={t.product.protocolNext} className="grid size-11 place-items-center rounded-full hover:bg-white">
                <ChevronRight className="size-4" strokeWidth={1.25} aria-hidden />
              </button>
            </div>
          )}
        </div>
        <ProtocolItem key={current.id} product={current} />
      </div>
      <button
        type="button"
        onClick={() => setDrawer(true)}
        className="mt-3 w-full rounded-full border border-navy px-5 py-2.5 text-[14px] transition-colors hover:bg-navy hover:text-white"
      >
        {t.common.viewAllProducts}
      </button>

      <dialog
        ref={drawerRef}
        onClose={() => setDrawer(false)}
        onClick={(e) => e.target === drawerRef.current && setDrawer(false)}
        aria-label={t.product.protocol}
        inert={!drawer}
        aria-hidden={!drawer}
        className="ml-auto mr-0 h-dvh max-h-none w-[min(440px,100vw)] max-w-none bg-white p-0 text-navy backdrop:bg-navy/30"
      >
        {drawer && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <h2 className="text-micro">{t.product.protocol}</h2>
              <button type="button" onClick={() => setDrawer(false)} aria-label={t.common.close} className="grid size-9 place-items-center">
                <X className="size-5" strokeWidth={1.25} aria-hidden />
              </button>
            </div>
            <ol className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {items.map((p, i) => (
                <li key={p.id}>
                  <p className="text-micro mb-2 text-muted">{t.product.step(i + 1)}</p>
                  <ProtocolItem product={p} />
                </li>
              ))}
            </ol>
            <div className="border-t border-line p-4">
              <button type="button" onClick={() => setDrawer(false)} className="h-11 w-full rounded-full border border-navy text-[14px]">
                {t.common.close}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
