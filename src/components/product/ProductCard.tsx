import Link from "next/link";
import { t } from "@/i18n";
import type { ProductCardData } from "@/server/queries/catalog";
import { CardGallery } from "./CardGallery";
import { QuickView } from "./QuickView";
import { VariantPicker } from "./VariantPicker";

type Props = {
  product: ProductCardData;
  priority?: boolean;
  /** Routine step shown on CONCERN collections */
  step?: number;
  /** Quick view (desktop) */
  quickView?: boolean;
  /** Name and benefits centred (BR "shop the look" card) */
  centered?: boolean;
};

export function ProductCard({ product, priority, step, quickView = true, centered = false }: Props) {
  const href = `/products/${product.slug}`;
  const isBundle = product.kind === "BUNDLE";

  // BR card (docs/br-measurements.json): #f1f0eb, full-bleed square image, badge 24px/16px from the corner,
  // info 16px 24px (4px 16px 12px on phones), name 17/20, price row 34px + 16px bottom
  return (
    <article data-br="card.wrapper" className="group relative flex h-full flex-col bg-card">
      {product.badge && (
        <span data-br="card.badge" className="text-badge absolute left-[18px] top-2 z-10 md:left-6 md:top-4">{t.badge[product.badge]}</span>
      )}
      {step !== undefined && (
        <span className="text-badge absolute right-[18px] top-2 z-10 md:right-6 md:top-4">{t.product.step(step)}</span>
      )}

      <div data-br="card.media" className="relative w-full">
        <CardGallery
          href={href}
          name={product.name}
          images={product.images}
          priority={priority}
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 57vw"
        />
        {quickView && <QuickView product={product} href={href} />}
      </div>

      {/* Name/benefits flex; price and cart button stick to the card bottom */}
      <div className="flex flex-1 flex-col px-4 pb-3 pt-1 md:px-6 md:pb-4 md:pt-4">
        <Link href={href} className={`block ${centered ? "text-center" : ""}`}>
          <h3 data-br="card.name" className="text-product line-clamp-2 break-words pb-[2px]">{product.name}</h3>
        </Link>
        {product.benefits.length > 0 && (
          <p className={`text-micro ${centered ? "line-clamp-3 text-center" : "line-clamp-2"}`}>{product.benefits.join(" / ")}</p>
        )}
        {isBundle && product.bundleSummary && (
          <p className="mt-2 text-note leading-snug text-muted">{product.bundleSummary}</p>
        )}
        <VariantPicker variants={product.variants} hideSizes={isBundle} />
      </div>
    </article>
  );
}
