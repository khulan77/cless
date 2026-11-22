import type { FeaturedProductSetting } from "@/lib/site-settings";
import type { ProductCardData } from "@/server/queries/catalog";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ProductCard } from "@/components/product/ProductCard";

export function FeaturedProduct({ setting, product }: { setting: FeaturedProductSetting; product: ProductCardData }) {
  return (
    <Container as="section" aria-labelledby="featured-title" className="mt-16 md:mt-24">
      <SectionTitle id="featured-title">{setting.title}</SectionTitle>
      <div className="grid gap-1.5 md:grid-cols-2">
        <div className="relative aspect-square w-full overflow-hidden bg-promo">
          <Img src={setting.image.src} alt={setting.image.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
        <ProductCard product={product} size="lg" />
      </div>
    </Container>
  );
}
