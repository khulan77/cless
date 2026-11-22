import Link from "next/link";
import { cacheLife } from "next/cache";
import type { FooterSetting } from "@/lib/site-settings";
import { Container } from "@/components/ui/Container";
import { NewsletterForm } from "./NewsletterForm";
import { SocialIcon } from "./SocialIcon";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function Footer({ footer, wordmark, siteName }: { footer: FooterSetting; wordmark: string[]; siteName: string }) {
  const { columns, contact, socials, newsletter, copyright } = footer;
  return (
    <footer className="on-dark mt-auto bg-navy text-white">
      <Container className="pb-8 pt-16 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_2fr]">
          <div className="max-w-sm">
            <Link href="/" aria-label={`${siteName} — нүүр хуудас`} className="inline-flex flex-col font-serif leading-none">
              {wordmark.map((line, i) => (
                <span
                  key={line}
                  className={i === wordmark.length - 1 ? "mt-1 text-[9px] tracking-[0.5em]" : "text-[18px] tracking-[0.32em]"}
                >
                  {line}
                </span>
              ))}
            </Link>
            <div className="mt-10">
              <h2 className="text-micro mb-2">{newsletter.title}</h2>
              <p className="mb-4 text-[14px] text-white/75">{newsletter.text}</p>
              <NewsletterForm placeholder={newsletter.placeholder} button={newsletter.button} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="text-micro mb-4">{col.title}</h2>
                <ul className="space-y-2.5 text-[14px] text-white/80">
                  {col.links.map((l) => (
                    <li key={`${l.label}-${l.href}`}>
                      <Link href={l.href} className="hover:text-white hover:underline">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <div className="col-span-2 md:col-span-1">
              <h2 className="text-micro mb-4">{contact.title}</h2>
              <address className="space-y-2.5 text-[14px] not-italic text-white/80">
                <p>{contact.address}</p>
                <p>
                  <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="hover:underline">
                    {contact.phone}
                  </a>
                </p>
                <p>
                  <a href={`mailto:${contact.email}`} className="hover:underline">
                    {contact.email}
                  </a>
                </p>
                {contact.hours.map((h) => (
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
                      className="grid size-10 place-items-center rounded-full border border-white/40 hover:bg-white hover:text-navy"
                    >
                      <SocialIcon network={s.network} className="size-[18px]" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-white/20 pt-6 text-[12px] text-white/60">
          © <CurrentYear /> {copyright}
        </div>
      </Container>
    </footer>
  );
}
