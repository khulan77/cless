import type { Metadata } from "next";
import { BookingSheetButton } from "@/components/salon/BookingSheet";
import { ServiceCard } from "@/components/services/ServiceCard";
import { Container } from "@/components/ui/Container";
import { t } from "@/i18n";
import { absoluteUrl } from "@/lib/site-url";
import { getPublicPackages, getPublicServiceGroups } from "@/server/queries/catalog";
import { formatMNT } from "@/lib/money";
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
  const [groups, banner, salon, packages] = await Promise.all([getPublicServiceGroups(), getSetting("servicesBanner"), getSalonInfo(), getPublicPackages()]);
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
      {packages.length > 0 && (
        <section aria-labelledby="svc-packages" className="mt-12 md:mt-16">
          <h2 id="svc-packages" className="text-micro mb-5 text-center">
            Багц үйлчилгээ
          </h2>
          <ul className="grid gap-1.5 md:grid-cols-2">
            {packages.map((p) => (
              <li key={p.id} className="bg-card p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-product">{p.name}</h3>
                  <span className="shrink-0 tabular-nums">{formatMNT(p.price)}</span>
                </div>
                <p className="mt-1 text-[14px] text-muted">
                  {p.paidSessions}
                  {p.bonusSessions > 0 ? ` + ${p.bonusSessions} бэлэг` : ""} = {p.paidSessions + p.bonusSessions} удаа
                  {p.validDays ? ` · ${p.validDays} хоногт` : ""}
                </p>
                {p.services.length > 0 && <p className="mt-1 text-[14px] text-muted">{p.services.join(", ")}</p>}
                {p.description && <p className="mt-2 text-[14px]">{p.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(groups.length > 0 || packages.length > 0) && <p className="mt-12 text-center text-body text-muted">{S.bookingNote}</p>}
    </Container>
  );
}
