import Link from "next/link";
import { cacheLife } from "next/cache";
import type { FooterSetting } from "@/lib/site-settings";
import { Container } from "@/components/ui/Container";
import { isCheckoutOnlyHref } from "@/lib/shop-mode";
import type { SalonInfo } from "@/server/queries/storefront";
import { t } from "@/i18n";
import { NewsletterForm } from "./NewsletterForm";
import { SocialIcon } from "./SocialIcon";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

type Column = { title: string; links: { label: string; href: string }[] };

export function Footer({
  footer,
  columns,
  wordmark,
  salon,
}: {
  footer: FooterSetting;
  /** Columns enriched with collections (resolveFooterColumns) */
  columns: Column[];
  wordmark: string[];
  /** Single source for contact details, socials and hours (Settings + branch hours) */
  salon: SalonInfo;
}) {
  const { contact, newsletter, copyright } = footer;
  const { siteName } = salon;
  const catalog = salon.shopMode === "CATALOG";
  const visibleColumns = columns
    .map((c) => ({ ...c, links: catalog ? c.links.filter((l) => !isCheckoutOnlyHref(l.href)) : c.links }))
    .filter((c) => c.links.length > 0);
  const socials = [
    salon.instagram ? { network: "instagram" as const, href: salon.instagram, label: "Instagram" } : null,
    salon.facebook ? { network: "facebook" as const, href: salon.facebook, label: "Facebook" } : null,
  ].filter((x) => x !== null);
  const tel = salon.phone.replace(/[^\d+]/g, "");
  return (
    <footer className="on-dark mt-auto bg-navy text-white">
      <Container className="pb-8 pt-16 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_2fr]">
          <div className="max-w-sm">
            <Link href="/" aria-label={t.layout.homeLink(wordmark.join(" "))} className="inline-flex flex-col font-serif leading-none">
              {wordmark.map((line, i) => (
                <span
                  key={line}
                  className={i === wordmark.length - 1 ? "mt-1 text-[9px] tracking-[0.5em]" : "text-[18px] tracking-[0.32em]"}
                >
                  {line}{" "}
                </span>
              ))}
            </Link>
            <div className="mt-10">
              <h2 className="text-footer-title mb-2">{newsletter.title}</h2>
              <p className="mb-4 text-body text-silver">{newsletter.text}</p>
              <NewsletterForm placeholder={newsletter.placeholder} button={newsletter.button} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {visibleColumns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="text-footer-title mb-4">{col.title}</h2>
                <ul className="text-body text-silver md:space-y-2.5">
                  {col.links.map((l) => (
                    <li key={`${l.label}-${l.href}`}>
                      <Link href={l.href} className="inline-flex min-h-11 items-center hover:text-white hover:underline md:min-h-0">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <div className="col-span-2 md:col-span-1">
              <h2 className="text-footer-title mb-4">{contact.title}</h2>
              <address className="text-body not-italic text-silver md:space-y-2.5 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center md:[&_a]:min-h-0">
                {salon.address && <p className="whitespace-pre-line">{salon.address}</p>}
                {salon.mapsUrl && (
                  <p>
                    <a href={salon.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {t.salon.openMap}
                    </a>
                  </p>
                )}
                {tel && (
                  <p>
                    <a href={`tel:${tel}`} className="hover:underline">
                      {salon.phone}
                    </a>
                  </p>
                )}
                {salon.email && (
                  <p>
                    <a href={`mailto:${salon.email}`} className="hover:underline">
                      {salon.email}
                    </a>
                  </p>
                )}
                {salon.hoursLines.map((h) => (
                  <p key={h}>{h}</p>
                ))}
              </address>
              <ul className="mt-6 flex gap-3">
                {socials.map((s) => (
                  <li key={s.network}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="grid size-11 place-items-center rounded-full border border-white/40 hover:bg-white hover:text-navy"
                    >
                      <SocialIcon network={s.network} className="size-[18px]" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-white/20 pt-6 text-note text-silver">
          © <CurrentYear /> {siteName}
          {copyright ? `. ${copyright}` : ""}
        </div>
      </Container>
    </footer>
  );
}
