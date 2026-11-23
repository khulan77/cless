import Link from "next/link";
import { benefitIcons } from "@/components/home/BenefitsBar";
import { Img } from "@/components/ui/Img";
import { t } from "@/i18n";
import type { ProductBenefitsSetting } from "@/lib/site-settings";
import type { BundleComponent, ProductCardData } from "@/server/queries/catalog";

export function BenefitsRow({ setting }: { setting: ProductBenefitsSetting | null }) {
  if (!setting?.items.length) return null;
  return (
    <ul className="mt-6 space-y-2.5 border-t border-line pt-6">
      {setting.items.map((b) => {
        const Icon = benefitIcons[b.icon];
        return (
          <li key={b.label} className="flex items-center gap-3 text-meta">
            <Icon className="size-5 shrink-0" strokeWidth={1.25} aria-hidden />
            {b.label}
          </li>
        );
      })}
    </ul>
  );
}

/** BUNDLE: components instead of the size selector */
export function BundleContents({ items }: { items: BundleComponent[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6" aria-labelledby="bundle-contents">
      <h2 id="bundle-contents" className="text-micro mb-3">{t.product.inBundle}</h2>
      <ul className="divide-y divide-line border-y border-line">
        {items.map((i) => (
          <li key={i.slug + i.size}>
            <Link href={`/products/${i.slug}`} className="flex items-center gap-3 py-3 hover:bg-card/50">
              <div className="relative size-12 shrink-0 bg-card">
                {i.image && <Img src={i.image.src} alt="" fill sizes="48px" className="object-contain p-1" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-product truncate text-meta">{i.name}</p>
                <p className="text-note text-muted">
                  {i.size}
                  {i.qty > 1 && ` · ${t.product.bundleQty(i.qty)}`}
                  {!i.available && ` · ${t.product.soldOut}`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PerfectMatch({ product }: { product: ProductCardData }) {
  const img = product.images[0];
  return (
    <section aria-labelledby="perfect-match" className="mt-16 grid md:mt-24 md:grid-cols-2">
      <div className="relative aspect-square bg-card md:aspect-auto md:min-h-[480px]">
        {img && <Img src={img.src} alt={img.alt || t.product.image(product.name)} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-contain p-10" />}
      </div>
      <div className="flex flex-col items-center justify-center bg-promo px-6 py-14 text-center md:px-16">
        <p className="text-micro mb-4">{t.product.perfectMatch}</p>
        <h2 id="perfect-match" className="text-section">{product.name}</h2>
        {product.tagline && <p className="mt-4 max-w-[40ch] text-muted">{product.tagline}</p>}
        <Link href={`/products/${product.slug}`} className="link-underline mt-6 text-button">
          {t.common.shop}
        </Link>
      </div>
    </section>
  );
}

export function ClinicalNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <section aria-label={t.product.clinicalNotes} className="mt-16 border-t border-line pt-6">
      <ol className="list-decimal space-y-1 pl-5 text-note text-muted">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ol>
    </section>
  );
}
