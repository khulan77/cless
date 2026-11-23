import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingSheetButton } from "@/components/salon/BookingSheet";
import { ServiceCard, servicePrice } from "@/components/services/ServiceCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { JsonLd } from "@/components/ui/JsonLd";
import { t } from "@/i18n";
import { realImageSrc } from "@/lib/placeholder";
import { absoluteUrl } from "@/lib/site-url";
import { getPublicService, getPublicServiceSlugs } from "@/server/queries/catalog";
import { getSalonInfo } from "@/server/queries/storefront";
import { isPlaceholderSlug, staticSlugParams } from "@/server/static-params";

const S = t.pages.services;
type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return staticSlugParams("/services/[slug]", getPublicServiceSlugs);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (isPlaceholderSlug(slug)) return { title: S.title };
  const s = await getPublicService(slug);
  if (!s) return { title: S.title };
  const description = (s.shortDescription || s.description).slice(0, 160);
  const src = realImageSrc(s.image);
  return {
    title: s.name,
    description,
    alternates: { canonical: absoluteUrl(`/services/${s.slug}`) },
    openGraph: { type: "website", locale: "mn_MN", url: absoluteUrl(`/services/${s.slug}`), title: s.name, description, images: src ? [absoluteUrl(src)] : undefined },
  };
}

export default function ServicePage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <ServiceView params={params} />
    </Suspense>
  );
}

async function ServiceView({ params }: Props) {
  const { slug } = await params;
  if (isPlaceholderSlug(slug)) notFound();
  const [s, salon] = await Promise.all([getPublicService(slug), getSalonInfo()]);
  if (!s) notFound();
  const src = realImageSrc(s.image);
  const href = `/services/${s.slug}`;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: s.name,
          description: s.shortDescription || s.description,
          serviceType: s.category ?? undefined,
          url: absoluteUrl(href),
          provider: { "@type": "BeautySalon", name: salon.siteName, telephone: salon.phone || undefined, address: salon.address || undefined },
          offers: { "@type": "Offer", price: s.price, priceCurrency: "MNT" },
        }}
      />
      <Container className="pb-16 pt-6 md:pt-10">
        <Breadcrumbs items={[{ name: S.title, href: "/services" }]} current={{ name: s.name, href }} />
        <div className={`mt-6 grid gap-8 ${src ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14" : "max-w-[720px]"}`}>
          {src && (
            <div className="relative aspect-[4/3] bg-card">
              <Img src={src} alt={s.name} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            </div>
          )}
          <div>
            {s.category && <p className="text-micro text-muted">{s.category}</p>}
            <h1 className="text-section mt-2 text-left">{s.name}</h1>
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-body">
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">{S.duration}</dt>
                <dd className="flex items-center gap-1.5">
                  <Clock className="size-4 text-muted" strokeWidth={1.25} aria-hidden />
                  {S.minutes(s.durationMin)}
                </dd>
              </div>
              <div>
                <dt className="sr-only">{S.price}</dt>
                <dd className="text-price">{servicePrice(s)}</dd>
              </div>
            </dl>
            <p className="mt-6 whitespace-pre-line text-body leading-relaxed">{s.description}</p>
            {s.suitableFor && (
              <section className="mt-8">
                <h2 className="text-micro mb-2">{S.suitableFor}</h2>
                <p className="whitespace-pre-line text-body text-navy/85">{s.suitableFor}</p>
              </section>
            )}
            {s.results && (
              <section className="mt-6">
                <h2 className="text-micro mb-2">{S.results}</h2>
                <p className="whitespace-pre-line text-body text-navy/85">{s.results}</p>
              </section>
            )}
            <div className="mt-8">
              <BookingSheetButton salon={salon} className="w-full sm:w-auto" />
              <p className="mt-3 text-meta text-muted">{S.bookingNote}</p>
            </div>
          </div>
        </div>

        {s.related.length > 0 && (
          <section aria-labelledby="related-services" className="section-gap">
            <h2 id="related-services" className="text-micro mb-5 text-center">
              {S.related}
            </h2>
            <ul className="grid gap-1.5 md:grid-cols-2 lg:grid-cols-3">
              {s.related.map((r) => (
                <ServiceCard key={r.slug} service={r} />
              ))}
            </ul>
          </section>
        )}
      </Container>
    </>
  );
}
