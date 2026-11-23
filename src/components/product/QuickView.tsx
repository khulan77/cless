"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Img } from "@/components/ui/Img";
import { t } from "@/i18n";
import type { ProductCardData } from "@/server/queries/catalog";
import { VariantPicker } from "./VariantPicker";

/** Desktop "quick view" button that slides up on card hover, plus its modal */
export function QuickView({ product, href }: { product: ProductCardData; href: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal(); // native: focus trap + Esc
    if (!open && el.open) el.close();
  }, [open]);

  const img = product.images[active] ?? product.images[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.product.quickViewOf(product.name)}
        className="absolute inset-x-3 bottom-3 hidden h-10 translate-y-2 rounded-full bg-white text-button opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 md:block"
      >
        {t.product.quickView}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialogRef.current && setOpen(false)}
        aria-label={product.name}
        inert={!open}
        aria-hidden={!open}
        className="m-auto w-[min(920px,calc(100vw-48px))] max-w-none bg-white p-0 text-navy backdrop:bg-navy/40"
      >
        {open && (
          <div className="grid md:grid-cols-[1.1fr_1fr]">
            <div className="bg-card p-6">
              <div className="relative aspect-square">
                {img && <Img src={img.src} alt={img.alt || t.product.image(product.name)} fill sizes="460px" className="object-contain" />}
              </div>
              {product.images.length > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                  {product.images.map((im, i) => (
                    <button
                      key={im.src + i}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-label={t.product.showImage(i + 1)}
                      aria-current={i === active}
                      className={`relative size-14 border bg-white ${i === active ? "border-navy" : "border-transparent"}`}
                    >
                      <Img src={im.src} alt="" fill sizes="56px" className="object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative flex flex-col p-8">
              <button type="button" onClick={() => setOpen(false)} aria-label={t.common.close} className="absolute right-3 top-3 grid size-9 place-items-center">
                <X className="size-5" strokeWidth={1.25} aria-hidden />
              </button>
              {product.badge && <p className="text-micro mb-3">{t.badge[product.badge]}</p>}
              <h2 className="text-product">{product.name}</h2>
              {product.tagline && <p className="mt-2 text-body">{product.tagline}</p>}
              {product.benefits.length > 0 && <p className="text-micro mt-3 text-muted">{product.benefits.join(" / ")}</p>}
              {product.bundleSummary && <p className="mt-3 text-meta text-muted">{product.bundleSummary}</p>}
              <VariantPicker variants={product.variants} hideSizes={product.kind === "BUNDLE"} large />
              <Link href={href} className="link-underline mt-6 self-start text-button relative before:absolute before:-inset-y-3 before:inset-x-0 before:content-['']">
                {t.product.viewDetails} →
              </Link>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
