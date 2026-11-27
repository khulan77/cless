import type { Metadata } from "next";
import { BookingSheetButton } from "@/components/salon/BookingSheet";
import { ServiceCard } from "@/components/services/ServiceCard";
import { Container } from "@/components/ui/Container";
import { t } from "@/i18n";
import { absoluteUrl } from "@/lib/site-url";
import { getPublicServiceGroups } from "@/server/queries/catalog";
import { getSetting } from "@/server/queries/settings";
import { getSalonInfo } from "@/server/queries/storefront";

const S = t.pages.services;

export const metadata: Metadata = {
  title: S.title,
  description: S.description,
  alternates: { canonical: absoluteUrl("/services") },
  openGraph: { title: S.title, description: S.description, url: absoluteUrl("/services"), locale: "mn_MN", type: "website" },
};

/** From the Service table (active, bookable, public), grouped by category. Booking = call / DM, never online. */
export default async function ServicesPage() {
  const [groups, banner, salon] = await Promise.all([getPublicServiceGroups(), getSetting("servicesBanner"), getSalonInfo()]);
  const single = groups.length === 1;
  return (
    <Container as="section" className="py-12 md:py-16">
      <header className="mx-auto max-w-[640px] text-center">
        <h1 className="text-section">{banner?.title ?? S.title}</h1>
        <p className="mt-4 text-muted">{banner?.text || S.description}</p>
        <div className="mt-6">
          <BookingSheetButton salon={salon} />
        </div>
      </header>

      {groups.length === 0 ? (
        // PROMPT 23: хоосон үед — бүлгийн гарчиг, 0₮ карт үгүй; утас + цаг захиалах товч (дээр)
        <div className="mx-auto mt-12 max-w-[520px] text-center">
          <p className="text-muted">{S.empty}</p>
          {salon.phone && (
            <a href={`tel:${salon.phone.replace(/[^\d+]/g, "")}`} className="mt-4 inline-block text-body underline underline-offset-4">
              {salon.phone}
            </a>
          )}
        </div>
      ) : (
        groups.map((g, i) => (
          <section key={g.category ?? "other"} aria-labelledby={`svc-group-${i}`} className="mt-12 md:mt-16">
            <h2 id={`svc-group-${i}`} className={`text-micro mb-5 text-center ${single && !g.category ? "sr-only" : ""}`}>
              {g.category ?? S.other}
            </h2>
            <ul className="grid gap-1.5 md:grid-cols-2">
              {g.services.map((s) => (
                <ServiceCard key={s.slug} service={s} />
              ))}
            </ul>
          </section>
        ))
      )}
      {groups.length > 0 && <p className="mt-12 text-center text-body text-muted">{S.bookingNote}</p>}
    </Container>
  );
}
