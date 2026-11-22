import Link from "next/link";
import { t } from "@/i18n";
import type { ProductCardData } from "@/server/queries/catalog";
import { CardGallery } from "./CardGallery";
import { QuickView } from "./QuickView";
import { VariantPicker } from "./VariantPicker";

type Props = {
  product: ProductCardData;
  size?: "md" | "lg";
  priority?: boolean;
  /** Routine step shown on CONCERN collections */
  step?: number;
  /** Quick view (desktop) */
  quickView?: boolean;
};

export function ProductCard({ product, size = "md", priority, step, quickView = true }: Props) {
  const large = size === "lg";
  const href = `/products/${product.slug}`;
  const isBundle = product.kind === "BUNDLE";

  return (
    <article className={`group relative flex h-full flex-col bg-card ${large ? "p-6 md:p-10" : "p-4 md:p-5"}`}>
      {product.badge && (
        <span className="text-micro absolute left-4 top-4 z-10 md:left-5 md:top-5">{t.badge[product.badge]}</span>
      )}
      {step !== undefined && (
        <span className="text-micro absolute right-4 top-4 z-10 md:right-5 md:top-5">{t.product.step(step)}</span>
      )}

      <div className={`relative mx-auto w-full ${large ? "max-w-[420px]" : ""}`}>
        <CardGallery
          href={href}
          name={product.name}
          images={product.images}
          priority={priority}
          sizes={large ? "(min-width: 768px) 40vw, 90vw" : "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"}
        />
        {quickView && <QuickView product={product} href={href} />}
      </div>

      {/* Name/benefits flex; price and cart button stick to the card bottom */}
      <div className="flex flex-1 flex-col">
        <Link href={href} className="mt-4 block">
          <h3 className={`text-product ${large ? "md:text-[21px]" : ""}`}>{product.name}</h3>
        </Link>
        {product.benefits.length > 0 && <p className="text-micro mt-1.5 text-muted">{product.benefits.join(" / ")}</p>}
        {isBundle && product.bundleSummary && (
          <p className="mt-2 text-[12px] leading-snug text-muted">{product.bundleSummary}</p>
        )}
        <VariantPicker variants={product.variants} hideSizes={isBundle} large={large} />
      </div>
    </article>
  );
}
