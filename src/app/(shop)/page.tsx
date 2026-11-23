import { BenefitsBar } from "@/components/home/BenefitsBar";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ConcernGrid } from "@/components/home/ConcernGrid";
import { FeaturedProduct } from "@/components/home/FeaturedProduct";
import { FullBleedBanner } from "@/components/home/FullBleedBanner";
import { Hero } from "@/components/home/Hero";
import { ProductCarousel } from "@/components/home/ProductCarousel";
import { PromoTrio } from "@/components/home/PromoTrio";
import { SplitPromo } from "@/components/home/SplitPromo";
import { ProductCard } from "@/components/product/ProductCard";
import { PillLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getBadgedProducts, getCollections, getProductCard } from "@/server/queries/catalog";
import { getSetting } from "@/server/queries/settings";
import { getSalonInfo } from "@/server/queries/storefront";
import { BookingSheetButton } from "@/components/salon/BookingSheet";
import { JsonLd } from "@/components/ui/JsonLd";
import { beautySalonJsonLd } from "@/lib/salon-jsonld";

// Кэш: cacheComponents горимд `revalidate = 60`-ийн оронд query бүр
// "use cache" + cacheLife({ revalidate: 60 })-тэй (src/server/queries/*).

export default async function HomePage() {
  const [
    hero,
    promoTrio,
    splitPromo,
    featured,
    iconic,
    salonBanner,
    concernGrid,
    categoryGrid,
    servicesBanner,
    benefits,
    badgedProducts,
    concerns,
    categories,
    salon,
  ] = await Promise.all([
    getSetting("hero"),
    getSetting("promoTrio"),
    getSetting("splitPromo"),
    getSetting("featuredProduct"),
    getSetting("iconicCarousel"),
    getSetting("salonBanner"),
    getSetting("concernGrid"),
    getSetting("categoryGrid"),
    getSetting("servicesBanner"),
    getSetting("benefits"),
    getBadgedProducts(["ICONIC", "NEW"], 12),
    getCollections("CONCERN", { onlyHome: true, limit: 8 }),
    getCollections("CATEGORY", { onlyHome: true, limit: 4 }),
    getSalonInfo(),
  ]);
  const featuredProduct = featured ? await getProductCard(featured.productSlug) : null;

  return (
    <>
      <JsonLd data={beautySalonJsonLd(salon)} />
      {hero && <Hero hero={hero} />}
      {promoTrio && promoTrio.items.length > 0 && <PromoTrio promo={promoTrio} />}
      {splitPromo && <SplitPromo promo={splitPromo} />}
      {featured && featuredProduct && <FeaturedProduct setting={featured} product={featuredProduct} />}

      {iconic && badgedProducts.length > 0 && (
        <Container as="section" aria-labelledby="iconic-title" className="section-gap">
          <SectionTitle id="iconic-title">{iconic.title}</SectionTitle>
          <ProductCarousel label={iconic.title}>
            {badgedProducts.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </ProductCarousel>
          <div className="mt-10 flex justify-center">
            <PillLink href={iconic.cta.href}>{iconic.cta.label}</PillLink>
          </div>
        </Container>
      )}

      {salonBanner && (
        <FullBleedBanner banner={salonBanner} id="salon-title" extra={<BookingSheetButton salon={salon} variant="outline" />} />
      )}
      {concernGrid && concerns.length > 0 && <ConcernGrid setting={concernGrid} concerns={concerns} />}
      {categoryGrid && categories.length > 0 && <CategoryGrid setting={categoryGrid} categories={categories} />}
      {servicesBanner && (
        <FullBleedBanner banner={servicesBanner} id="services-title" extra={<BookingSheetButton salon={salon} variant="outline" />} />
      )}
      {benefits && <BenefitsBar benefits={benefits} />}
    </>
  );
}
