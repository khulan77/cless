import type { FeaturedProductSetting } from "@/lib/site-settings";
import type { ProductCardData } from "@/server/queries/catalog";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { realImageSrc } from "@/lib/placeholder";
import { ProductCard } from "@/components/product/ProductCard";

/**
 * BR "shop the look" (Nouveau sérum imperfections), measured at 1440/390px:
 * 27px title, 30px above two squares 5px apart — the campaign image and a white panel
 * (50px 100px 0 padding) with a 380px product card, vertically centred, name centred.
 * Phones: title 24px, 20px gap; image full width, the card (195px) centred 30px below.
 */
export function FeaturedProduct({ setting, product }: { setting: FeaturedProductSetting; product: ProductCardData }) {
  const src = realImageSrc(setting.image.src);
  return (
    <Container as="section" pad="inset-wide" aria-labelledby="featured-title" className="section-gap">
      <h2 id="featured-title" data-br="featured.title" className="text-section text-center">
        {setting.title}
      </h2>
      <div className={`mt-5 grid md:mt-[30px] md:gap-[5px] ${src ? "md:grid-cols-2" : ""}`}>
        {src && (
          <div data-br="featured.image" className="relative aspect-square w-full overflow-hidden bg-promo">
            <Img src={src} alt={setting.image.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        )}
        <div data-br="featured.content" className="flex items-center justify-center pt-[30px] md:aspect-square md:justify-start md:px-[100px] md:pt-[50px]">
          <div data-br="featured.card" className="w-[195px] md:w-[380px]">
            <ProductCard product={product} centered quickView={false} />
          </div>
        </div>
      </div>
    </Container>
  );
}
