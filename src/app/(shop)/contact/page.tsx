import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { SocialIcon } from "@/components/layout/SocialIcon";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { Container } from "@/components/ui/Container";
import { t } from "@/i18n";
import { getSetting } from "@/server/queries/settings";

export const metadata = { title: t.pages.contact.title };

const C = t.pages.contact;

/** Reads the same "footer" setting the footer uses, so both always match */
export default async function ContactPage() {
  const footer = await getSetting("footer");
  if (!footer) return <ComingSoon title={C.title} text={C.text} />;
  const { contact } = footer;
  const socials = footer.socials.filter((s) => s.href);

  const rows = [
    {
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
    {
      icon: Phone,
      label: C.phone,
      content: (
        <a href={`tel:${contact.phone.replace(/[\s-]+/g, "")}`} className="link-underline">
          {contact.phone}
        </a>
      ),
    },
    {
      icon: Mail,
      label: C.email,
      content: (
        <a href={`mailto:${contact.email}`} className="link-underline">
          {contact.email}
        </a>
      ),
    },
    {
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
  ];

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
