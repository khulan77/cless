import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductCarousel } from "@/components/home/ProductCarousel";
import { ProductCard } from "@/components/product/ProductCard";
import { Accordion, type AccordionItem } from "@/components/product-page/Accordion";
import { ProductGallery } from "@/components/product-page/ProductGallery";
import { BenefitsRow, BundleContents, ClinicalNotes, PerfectMatch } from "@/components/product-page/ProductSections";
import { ProtocolBox } from "@/components/product-page/ProtocolBox";
import { AddToCartMain, PriceLine, PurchaseProvider, SizeSelector, StickyPurchaseBar } from "@/components/product-page/Purchase";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Container } from "@/components/ui/Container";
import { JsonLd } from "@/components/ui/JsonLd";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { t } from "@/i18n";
import { absoluteUrl } from "@/lib/site-url";
import { getAllProductSlugs, getProductPage, productHref, type ProductPageData } from "@/server/queries/catalog";
import { getSetting } from "@/server/queries/settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getAllProductSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [p, brand] = await Promise.all([getProductPage(slug), getSetting("brand")]);
  if (!p) return { title: t.notFound.productTitle };
  const site = brand?.siteName ?? "";
  const description = p.seoDescription ?? [p.tagline, p.description].filter(Boolean).join(". ").slice(0, 160);
  const image = p.gallery[0];
  return {
    title: { absolute: p.seoTitle ?? t.seo.productTitle(p.name, p.tagline, site) },
    description,
    alternates: { canonical: absoluteUrl(productHref(p.slug)) },
    openGraph: {
      type: "website",
      url: absoluteUrl(productHref(p.slug)),
      title: p.seoTitle ?? `${p.name} — ${p.tagline ?? site}`,
      description,
      images: image ? [{ url: absoluteUrl(image.src), alt: image.alt || p.name }] : undefined,
    },
  };
}

export default function ProductPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-[80vh]" />}>
      <ProductView params={params} />
    </Suspense>
  );
}

function productJsonLd(p: ProductPageData) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.tagline ? `${p.tagline}. ${p.description}` : p.description,
    image: p.gallery.map((g) => absoluteUrl(g.src)),
    sku: p.variants[0] ? p.skus[p.variants[0].id] : undefined,
    brand: { "@type": "Brand", name: "Biologique Recherche" },
    offers: p.variants.map((v) => ({
      "@type": "Offer",
      sku: p.skus[v.id],
      name: `${p.name} ${v.size}`,
      price: v.price,
      priceCurrency: "MNT",
      availability: v.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: absoluteUrl(`${productHref(p.slug)}?variant=${v.id}`),
    })),
  };
}

async function ProductView({ params }: Props) {
  const { slug } = await params;
  const [p, benefits] = await Promise.all([getProductPage(slug), getSetting("productBenefits")]);
  if (!p) notFound();
  const isBundle = p.kind === "BUNDLE";

  const env = p.environmental;
  const accordionCandidates: (AccordionItem | false | null | "")[] = [
    { id: "description", title: t.product.description, content: <p className="whitespace-pre-line">{p.description}</p> },
    p.skinScience && { id: "science", title: t.product.skinScience, content: <p className="whitespace-pre-line">{p.skinScience}</p> },
    p.howToUse.length > 0 && {
      id: "how",
      title: t.product.howToUse,
      content: (
        <ol className="list-decimal space-y-1.5 pl-5">
          {p.howToUse.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      ),
    },
    p.ingredients && {
      id: "ingredients",
      title: t.product.ingredients,
      content: (
        <>
          <p lang="la" className="text-[13px]">{p.ingredients}</p>
          <p className="mt-3 text-[12px] text-muted">{t.product.ingredientsWarning}</p>
        </>
      ),
    },
    env.length > 0 && {
      id: "env",
      title: t.product.environmental,
      content: (
        <dl className="space-y-1.5">
          {env.map((e) => (
            <div key={e.key} className="flex gap-2">
              <dt className="text-muted">{e.key}:</dt>
              <dd>{e.value}</dd>
            </div>
          ))}
        </dl>
      ),
    },
  ];
  const accordion = accordionCandidates.filter((x): x is AccordionItem => Boolean(x));

  return (
    <PurchaseProvider variants={p.variants} isBundle={isBundle}>
      <JsonLd data={productJsonLd(p)} />
      <Container className="pb-8 pt-6 md:pt-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] lg:gap-14">
          {/* Desktop: gallery наалддаг, мэдээллийн багана энгийн scroll — зүүн тал хоосрохгүй */}
          <div className="lg:sticky lg:top-[96px] lg:self-start">
            <ProductGallery images={p.gallery} name={p.name} />
          </div>

          <div>
            <Breadcrumbs
              items={p.breadcrumb}
              current={{ name: p.name, href: productHref(p.slug) }}
            />
            {p.badge && <p className="text-micro mt-6">{t.badge[p.badge]}</p>}
            <h1 className="text-section mt-2 text-left">{p.name}</h1>
            {p.tagline && <p className="mt-2 text-[16px]">{p.tagline}</p>}
            {p.recommendedFor && <p className="mt-2 text-[14px] text-muted">{p.recommendedFor}</p>}
            {p.benefits.length > 0 && <p className="text-micro mt-4 text-muted">{p.benefits.join(" / ")}</p>}

            <PriceLine />
            {isBundle ? <BundleContents items={p.bundleItems} /> : <SizeSelector />}
            <AddToCartMain />
            <BenefitsRow setting={benefits} />
            <ProtocolBox items={p.protocol} />
            <Accordion items={accordion} />
          </div>
        </div>
      </Container>

      {p.perfectMatch && (
        <Container>
          <PerfectMatch product={p.perfectMatch} />
        </Container>
      )}

      {p.similar.length > 0 && (
        <Container as="section" aria-labelledby="similar-title" className="mt-16 md:mt-24">
          <SectionTitle id="similar-title">{t.product.similar}</SectionTitle>
          <ProductCarousel label={t.product.similar}>
            {p.similar.map((s) => (
              <ProductCard key={s.id} product={s} />
            ))}
          </ProductCarousel>
        </Container>
      )}

      <Container className="pb-24">
        <ClinicalNotes notes={p.clinicalNotes} />
      </Container>

      <StickyPurchaseBar name={p.name} image={p.gallery[0] ?? null} />
    </PurchaseProvider>
  );
}
