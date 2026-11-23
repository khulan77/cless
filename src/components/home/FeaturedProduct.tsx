import type { FeaturedProductSetting } from "@/lib/site-settings";
import type { ProductCardData } from "@/server/queries/catalog";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { realImageSrc } from "@/lib/placeholder";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ProductCard } from "@/components/product/ProductCard";

export function FeaturedProduct({ setting, product }: { setting: FeaturedProductSetting; product: ProductCardData }) {
  const src = realImageSrc(setting.image.src);
  return (
    <Container as="section" aria-labelledby="featured-title" className="section-gap">
      <SectionTitle id="featured-title">{setting.title}</SectionTitle>
      <div className={`grid gap-1.5 ${src ? "md:grid-cols-2" : "mx-auto max-w-[720px]"}`}>
        {src && (
          <div className="relative aspect-square w-full overflow-hidden bg-promo">
            <Img src={src} alt={setting.image.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        )}
        <ProductCard product={product} size="lg" />
      </div>
    </Container>
  );
}
