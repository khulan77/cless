import { openingHoursSpec, type WeekHours } from "@/lib/hours";
import { absoluteUrl } from "@/lib/site-url";

type Salon = { siteName: string; phone: string; email: string; address: string; mapsUrl: string | null; instagram: string | null; facebook: string | null; hours: WeekHours };

/** schema.org BeautySalon (a LocalBusiness) — home and /salon */
export function beautySalonJsonLd(s: Salon) {
  return {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: s.siteName,
    url: absoluteUrl("/salon"),
    telephone: s.phone || undefined,
    email: s.email || undefined,
    address: s.address ? { "@type": "PostalAddress", streetAddress: s.address, addressLocality: "Ulaanbaatar", addressCountry: "MN" } : undefined,
    hasMap: s.mapsUrl ?? undefined,
    sameAs: [s.instagram, s.facebook].filter(Boolean),
    openingHoursSpecification: openingHoursSpec(s.hours),
    currenciesAccepted: "MNT",
  };
}
