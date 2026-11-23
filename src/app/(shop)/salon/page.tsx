import type { Metadata } from "next";
import { Clock, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { BookingSheetButton } from "@/components/salon/BookingSheet";
import { Container } from "@/components/ui/Container";
import { BrandFallback, Img } from "@/components/ui/Img";
import { JsonLd } from "@/components/ui/JsonLd";
import { t } from "@/i18n";
import { realImageSrc } from "@/lib/placeholder";
import { beautySalonJsonLd } from "@/lib/salon-jsonld";
import { absoluteUrl } from "@/lib/site-url";
import { getSetting } from "@/server/queries/settings";
import { getSalonInfo } from "@/server/queries/storefront";

const P = t.pages.salon;

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getSalonInfo();
  return {
    title: P.title,
    description: P.description(siteName),
    alternates: { canonical: absoluteUrl("/salon") },
    openGraph: { type: "website", locale: "mn_MN", url: absoluteUrl("/salon"), title: P.title, description: P.description(siteName) },
  };
}

export default async function SalonPage() {
  const [salon, banner] = await Promise.all([getSalonInfo(), getSetting("salonBanner")]);
  const tel = salon.phone.replace(/[^\d+]/g, "");
  const photo = realImageSrc(banner?.image.src);

  return (
    <>
      <JsonLd data={beautySalonJsonLd(salon)} />
      <Container as="section" aria-labelledby="salon-title" className="py-12 md:py-16">
        <header className="mx-auto max-w-[640px] text-center">
          <h1 id="salon-title" className="text-section">
            {P.title}
          </h1>
          <p className="mt-4 text-muted">{banner?.text || P.intro}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <BookingSheetButton salon={salon} />
            <Link href="/services" className="link-underline inline-flex min-h-11 items-center text-button">
              {t.salon.services}
            </Link>
          </div>
        </header>

        {/* Photos: real ones from Сайтын контент → "Манай салон"; quiet brand blocks until then */}
        <ul aria-label={P.gallery} className="mt-12 grid grid-cols-2 gap-1.5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className={`relative aspect-[4/5] bg-card ${i === 0 ? "col-span-2 aspect-[16/10] md:col-span-1 md:aspect-[4/5]" : ""}`}>
              {photo && i === 0 ? <Img src={photo} alt={banner?.image.alt || P.photo(i + 1)} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" /> : <BrandFallback fill />}
            </li>
          ))}
        </ul>

        <ul className="mx-auto mt-12 grid max-w-[960px] gap-px bg-line md:grid-cols-3">
          {salon.address && (
            <li className="flex gap-4 bg-white p-6">
              <MapPin className="mt-0.5 size-5 shrink-0" strokeWidth={1.25} aria-hidden />
              <div>
                <h2 className="text-micro mb-2 text-muted">{t.salon.address}</h2>
                <p className="whitespace-pre-line text-body">{salon.address}</p>
                {salon.mapsUrl && (
                  <p className="mt-3">
                    <a
                      href={salon.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-full border border-navy px-5 text-button transition-colors hover:bg-navy hover:text-white"
                    >
                      {t.salon.openMap}
                    </a>
                  </p>
                )}
              </div>
            </li>
          )}
          {salon.hoursLines.length > 0 && (
            <li className="flex gap-4 bg-white p-6">
              <Clock className="mt-0.5 size-5 shrink-0" strokeWidth={1.25} aria-hidden />
              <div>
                <h2 className="text-micro mb-2 text-muted">{t.salon.hours}</h2>
                {salon.hoursLines.map((l) => (
                  <p key={l} className="text-body">
                    {l}
                  </p>
                ))}
              </div>
            </li>
          )}
          {tel && (
            <li className="flex gap-4 bg-white p-6">
              <Phone className="mt-0.5 size-5 shrink-0" strokeWidth={1.25} aria-hidden />
              <div>
                <h2 className="text-micro mb-2 text-muted">{P.phone}</h2>
                <p className="text-body">
                  <a href={`tel:${tel}`} className="link-underline">
                    {salon.phone}
                  </a>
                </p>
              </div>
            </li>
          )}
        </ul>
      </Container>
    </>
  );
}
