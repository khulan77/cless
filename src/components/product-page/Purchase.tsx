"use client";

import { ShoppingBag } from "lucide-react";
import { createContext, useContext, useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { SizeOptions, defaultVariantId } from "@/components/product/VariantPicker";
import { InquirySheet } from "@/components/salon/InquirySheet";
import { useCatalogMode } from "@/components/salon/StorefrontContext";
import { Img } from "@/components/ui/Img";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import type { CardVariant } from "@/server/queries/catalog";

type Ctx = {
  productName: string;
  variants: CardVariant[];
  selected: CardVariant;
  select: (id: string) => void;
  allSoldOut: boolean;
  isBundle: boolean;
  mainButton: HTMLElement | null;
  setMainButton: (el: HTMLElement | null) => void;
};

const PurchaseContext = createContext<Ctx | null>(null);
const usePurchase = () => {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error("PurchaseProvider missing");
  return ctx;
};

// ?variant= is read without useSearchParams so the page stays statically prerendered.
const subscribeUrl = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};
const readUrlVariant = () => new URLSearchParams(window.location.search).get("variant");

export function PurchaseProvider({
  productName,
  variants,
  isBundle,
  children,
}: {
  productName: string;
  variants: CardVariant[];
  isBundle: boolean;
  children: ReactNode;
}) {
  const urlVariant = useSyncExternalStore(subscribeUrl, readUrlVariant, () => null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [mainButton, setMainButton] = useState<HTMLElement | null>(null);

  const fromUrl = variants.find((v) => v.id === urlVariant);
  const selectedId = chosen ?? fromUrl?.id ?? defaultVariantId(variants);
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0]!;

  const select = (id: string) => {
    setChosen(id);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", id);
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <PurchaseContext.Provider
      value={{ productName, variants, selected, select, allSoldOut: variants.every((v) => !v.available), isBundle, mainButton, setMainButton }}
    >
      {children}
    </PurchaseContext.Provider>
  );
}

/** CATALOG stock wording: in the salon / few left / sold out — we'll let you know */
export function stockLabel(v: CardVariant): string {
  if (!v.available) return t.stock.soldOut;
  return v.lowStock ? t.stock.low : t.stock.inSalon;
}

export function PriceLine() {
  const { selected, isBundle } = usePurchase();
  const catalog = useCatalogMode();
  return (
    <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1" aria-live="polite">
      <span className="text-price">{formatMNT(selected.price)}</span>
      {!isBundle && <span className="text-body text-muted">{selected.size}</span>}
      {catalog ? (
        <span className={`ml-auto text-meta ${selected.available ? "text-navy" : "text-muted"}`} data-testid="stock-label">
          {stockLabel(selected)}
        </span>
      ) : (
        selected.lowStock && <span className="ml-auto text-note text-muted">{t.product.lowStock}</span>
      )}
    </div>
  );
}

function useInquiryProduct() {
  const { productName, selected, isBundle } = usePurchase();
  return { variantId: selected.id, name: productName, size: isBundle ? null : selected.size, price: selected.price };
}

export function SizeSelector() {
  const { variants, selected, select, isBundle } = usePurchase();
  if (isBundle || variants.length < 2) return null;
  return (
    <div className="mt-6">
      <p className="text-micro mb-3">{t.product.size}</p>
      <SizeOptions variants={variants} selectedId={selected.id} onSelect={select} pill />
    </div>
  );
}

export function AddToCartMain() {
  const { selected, allSoldOut, setMainButton } = usePurchase();
  const catalog = useCatalogMode();
  const product = useInquiryProduct();
  const soldOut = allSoldOut || !selected.available;
  if (catalog) {
    // Sold out too: the hold request doubles as "let me know when it arrives"
    return (
      <div className="mt-6" ref={setMainButton}>
        <InquirySheet
          product={product}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              aria-haspopup="dialog"
              className="flex min-h-12 w-full items-center justify-center rounded-full bg-navy text-body tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              {t.inquiry.cta}
            </button>
          )}
        />
      </div>
    );
  }
  return (
    <div className="mt-6" ref={setMainButton}>
      {soldOut ? (
        <>
          <button type="button" disabled className="h-12 w-full cursor-not-allowed rounded-full bg-navy/30 text-button text-white">
            {t.product.soldOut}
          </button>
          {allSoldOut && <NotifyMe />}
        </>
      ) : (
        <button
          type="button"
          // TODO (cart round): add to cart
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-navy text-button tracking-[0.02em] text-white transition-opacity hover:opacity-90"
        >
          <ShoppingBag className="size-[18px]" strokeWidth={1.25} aria-hidden />
          {t.product.addToCart}
        </button>
      )}
    </div>
  );
}

/** "Notify me" — UI only for now */
function NotifyMe() {
  const id = useId();
  return (
    <form className="mt-5" onSubmit={(e) => e.preventDefault()}>
      <p className="mb-2 text-meta text-muted">{t.product.notifyHint}</p>
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">{t.product.notifyEmail}</label>
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          placeholder={t.product.notifyEmail}
          className="h-11 min-w-0 flex-1 border-b border-navy/30 bg-transparent text-body focus:border-navy focus:outline-none"
        />
        <button type="submit" className="h-11 shrink-0 rounded-full border border-navy px-5 text-button transition-colors hover:bg-navy hover:text-white">
          {t.product.notifyMe}
        </button>
      </div>
    </form>
  );
}

/** Slides up once the main add-to-cart button has scrolled out of view */
export function StickyPurchaseBar({ name, image }: { name: string; image: { src: string; alt: string } | null }) {
  const { selected, mainButton, allSoldOut, isBundle } = usePurchase();
  const catalog = useCatalogMode();
  const product = useInquiryProduct();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!mainButton) return;
    const io = new IntersectionObserver(([entry]) => {
      setVisible(!entry!.isIntersecting && entry!.boundingClientRect.top < 0);
    });
    io.observe(mainButton);
    return () => io.disconnect();
  }, [mainButton]);

  const soldOut = allSoldOut || !selected.available;
  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white transition-transform duration-300 ${visible ? "translate-y-0" : "translate-y-full"}`}
    >
      <div className="mx-auto flex max-w-[1376px] items-center gap-4 px-4 py-3 md:px-12">
        {image && (
          <div className="relative hidden size-12 shrink-0 bg-card sm:block">
            <Img src={image.src} alt="" fill sizes="48px" className="object-contain" />
          </div>
        )}
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="text-product truncate text-body">{name}</p>
          <p className="text-meta text-muted">
            {!isBundle && `${selected.size} · `}
            {formatMNT(selected.price)}
          </p>
        </div>
        {catalog ? (
          <InquirySheet
            product={product}
            trigger={(open) => (
              <button
                type="button"
                onClick={open}
                aria-haspopup="dialog"
                className="min-h-12 w-full rounded-full bg-navy px-8 text-body text-white transition-opacity hover:opacity-90 sm:w-auto"
              >
                {t.inquiry.cta}
                <span className="sm:hidden"> · {formatMNT(selected.price)}</span>
              </button>
            )}
          />
        ) : (
          <button
            type="button"
            disabled={soldOut}
            className="h-11 w-full rounded-full bg-navy px-8 text-button text-white transition-opacity hover:opacity-90 disabled:bg-navy/30 sm:w-auto"
          >
            {soldOut ? t.product.soldOut : `${t.product.addToCart} · ${formatMNT(selected.price)}`}
          </button>
        )}
      </div>
    </div>
  );
}
