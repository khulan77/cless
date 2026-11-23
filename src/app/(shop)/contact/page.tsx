import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { SocialIcon } from "@/components/layout/SocialIcon";
import { Container } from "@/components/ui/Container";
import { t } from "@/i18n";
import { BookingSheetButton } from "@/components/salon/BookingSheet";
import { getSalonInfo } from "@/server/queries/storefront";
import { getSetting } from "@/server/queries/settings";
import { isMapEmbedUrl } from "@/lib/validation/content-pages";

export const metadata = { title: t.pages.contact.title };

const C = t.pages.contact;

/** Same single source as the footer, header sheet and salon page (Settings + branch hours) */
export default async function ContactPage() {
  const salon = await getSalonInfo();
  const contact = { ...salon, hours: salon.hoursLines };
  const tel = salon.phone.replace(/[^\d+]/g, "");
  const socials = [
    salon.instagram ? { network: "instagram" as const, href: salon.instagram, label: "Instagram" } : null,
    salon.facebook ? { network: "facebook" as const, href: salon.facebook, label: "Facebook" } : null,
  ].filter((x) => x !== null);
  // Газрын зураг: SiteSetting "contactPage" (Админ → Сайтын контент → Холбоо барих хуудас)
  const contactPage = await getSetting("contactPage");
  const mapEmbedUrl = contactPage?.mapEmbedUrl && isMapEmbedUrl(contactPage.mapEmbedUrl) ? contactPage.mapEmbedUrl : null;

  const rows = [
    contact.address && {
      icon: MapPin,
      label: C.address,
      content: (
        <span className="whitespace-pre-line">
          {contact.address}
          {contact.mapsUrl && (
            <>
              {"\n"}
              <a href={contact.mapsUrl} target="_blank" rel="noopener noreferrer" className="link-underline">
                {C.openMap}
              </a>
            </>
          )}
        </span>
      ),
    },
    tel && {
      icon: Phone,
      label: C.phone,
      content: (
        <a href={`tel:${tel}`} className="link-underline">
          {contact.phone}
        </a>
      ),
    },
    contact.email && {
      icon: Mail,
      label: C.email,
      content: (
        <a href={`mailto:${contact.email}`} className="link-underline">
          {contact.email}
        </a>
      ),
    },
    contact.hours.length > 0 && {
      icon: Clock,
      label: C.hours,
      content: (
        <ul className="space-y-1">
          {contact.hours.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ),
    },
  ].filter((r) => !!r);

  return (
    <Container as="section" className="py-16 md:py-24">
      <header className="mx-auto max-w-[560px] text-center">
        <h1 className="text-section">{C.title}</h1>
        <p className="mt-4 text-muted">{C.intro}</p>
      </header>

      <dl className="mx-auto mt-12 grid max-w-[880px] gap-px bg-line sm:grid-cols-2">
        {rows.map(({ icon: Icon, label, content }) => (
          <div key={label} className="flex gap-4 bg-white p-6 md:p-8">
            <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={1.25} aria-hidden />
            <div>
              <dt className="text-micro mb-2 text-muted">{label}</dt>
              <dd className="text-[15px]">{content}</dd>
            </div>
          </div>
        ))}
      </dl>

      {mapEmbedUrl && (
        <div className="mx-auto mt-12 max-w-[880px]">
          <iframe
            src={mapEmbedUrl}
            title={`${C.address}: ${salon.address}`}
            className="aspect-[4/3] w-full border-0 sm:aspect-[16/9]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      )}
      <div className="mt-10 text-center">
        <BookingSheetButton salon={salon} />
      </div>

      {socials.length > 0 && (
        <div className="mt-12 text-center">
          <p className="text-micro mb-4 text-muted">{C.follow}</p>
          <ul className="flex justify-center gap-3">
            {socials.map((s) => (
              <li key={s.network}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="grid size-11 place-items-center rounded-full border border-navy transition-colors hover:bg-navy hover:text-white"
                >
                  <SocialIcon network={s.network} className="size-[18px]" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Container>
  );
}
