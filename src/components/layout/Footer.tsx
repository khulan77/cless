import Link from "next/link";
import { cacheLife } from "next/cache";
import type { FooterSetting } from "@/lib/site-settings";
import { isCheckoutOnlyHref } from "@/lib/shop-mode";
import type { SalonInfo } from "@/server/queries/storefront";
import { t } from "@/i18n";
import { BrandLogo } from "./BrandLogo";
import { NewsletterForm } from "./NewsletterForm";
import { SocialIcon } from "./SocialIcon";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

type Column = { title: string; links: { label: string; href: string }[] };

// BR footer rows are 32.4px: a 21px link + 5.7px above and below
const row = "py-[5.7px]";
const linkCls = "text-footer-link text-silver transition-colors hover:text-white";

/**
 * BR footer (docs/br-measurements.json): 64px 50px 40px padding (40px 15px on phones); four equal columns
 * 20px apart — the link columns, the salon column (links + address, phone, hours) and the newsletter;
 * 18px UPPERCASE titles 16px above 15px silver links; social icons (18px in 40px circles) 64px below;
 * then the logo, copyright (14px) and legal links (15px), 30px bottom padding.
 */
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
  const { newsletter, copyright } = footer;
  const { siteName } = salon;
  const catalog = salon.shopMode === "CATALOG";
  const visibleColumns = columns
    .map((c) => ({ ...c, links: catalog ? c.links.filter((l) => !isCheckoutOnlyHref(l.href)) : c.links }))
    .filter((c) => c.links.length > 0);
  // The salon column (the one linking to /services) also carries the address, phone and hours
  const salonIndex = Math.max(0, visibleColumns.findIndex((c) => c.links.some((l) => l.href.startsWith("/services"))));
  const socials = [
    salon.instagram ? { network: "instagram" as const, href: salon.instagram, label: "Instagram" } : null,
    salon.facebook ? { network: "facebook" as const, href: salon.facebook, label: "Facebook" } : null,
  ].filter((x) => x !== null);
  const tel = salon.phone.replace(/[^\d+]/g, "");

  return (
    <footer className="on-dark mt-auto bg-navy text-white">
      <div data-br="footer.top" className="px-[15px] pb-10 pt-10 md:px-[50px] md:pt-16">
        <div data-br="footer.blocks" className="grid gap-y-8 md:grid-cols-4 md:gap-x-5">
          {visibleColumns.map((col, i) => (
            <nav key={col.title} aria-label={col.title} data-br="footer.column">
              <h2 data-br="footer.title" className="text-footer-title mb-[10px]">{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={`${l.label}-${l.href}`} data-br="footer.item" className={row}>
                    <Link href={l.href} data-br="footer.link" className={`relative ${linkCls} before:absolute before:-inset-y-[12px] before:inset-x-0 before:content-[''] md:before:hidden`}>
                      {l.label}
                    </Link>
                  </li>
                ))}
                {i === salonIndex && (
                  <>
                    {salon.address && <li className={`${row} text-footer-link whitespace-pre-line text-silver`}>{salon.address}</li>}
                    {tel && (
                      <li className={row}>
                        <a href={`tel:${tel}`} className={linkCls}>
                          {salon.phone}
                        </a>
                      </li>
                    )}
                    {salon.email && (
                      <li className={row}>
                        <a href={`mailto:${salon.email}`} className={linkCls}>
                          {salon.email}
                        </a>
                      </li>
                    )}
                    {salon.hoursLines.map((h) => (
                      <li key={h} className={`${row} text-footer-link text-silver`}>
                        {h}
                      </li>
                    ))}
                    {salon.mapsUrl && (
                      <li className={row}>
                        <a href={salon.mapsUrl} target="_blank" rel="noopener noreferrer" className={`${linkCls} link-underline`}>
                          {t.salon.openMap}
                        </a>
                      </li>
                    )}
                  </>
                )}
              </ul>
            </nav>
          ))}

          <div>
            <h2 data-br="footer.newsletterTitle" className="text-footer-title">{newsletter.title}</h2>
            <p className="mt-[5px] max-w-[310px] text-footer-link text-silver">{newsletter.text}</p>
            <NewsletterForm placeholder={newsletter.placeholder} button={newsletter.button} />
          </div>
        </div>

        {socials.length > 0 && (
          <ul aria-label={t.footer.social} data-br="footer.social" className="-ml-[10px] mt-10 flex gap-[5px] md:mt-16">
            {socials.map((s) => (
              <li key={s.network}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  data-br="footer.socialItem"
                  className="grid size-10 place-items-center rounded-full text-[#c4c8ce] transition-colors hover:text-white"
                >
                  <SocialIcon network={s.network} className="size-[18px]" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-[15px] pb-[30px] md:px-[50px]">
        <Link href="/" aria-label={t.layout.homeLink(wordmark.join(" "))} className="inline-block">
          <BrandLogo className="h-[64px] w-[134.4px]" />
        </Link>
        <p data-br="footer.copyright" className="mt-4 text-copyright">
          © <CurrentYear /> {siteName}
          {copyright ? `. ${copyright}` : ""}
        </p>
        <nav aria-label={t.footer.legal} className="mt-[25px]">
          <ul className="flex flex-wrap text-legal">
            <li>
              <Link href="/privacy" data-br="footer.legalLink" className="hover:underline">
                {t.footer.privacy}
              </Link>
              <span aria-hidden className="mx-[6px]">
                /
              </span>
            </li>
            <li>
              <Link href="/contact" className="hover:underline">
                {t.footer.contact}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
