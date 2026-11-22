import Link from "next/link";
import { t } from "@/i18n";
import { absoluteUrl } from "@/lib/site-url";
import type { Crumb } from "@/server/queries/catalog";
import { JsonLd } from "./JsonLd";

/** Home › … › current, with BreadcrumbList JSON-LD */
export function Breadcrumbs({ items, current, className = "" }: { items: Crumb[]; current: Crumb; className?: string }) {
  const all = [{ name: t.common.home, href: "/" }, ...items, current];
  return (
    <>
      <nav aria-label={t.common.breadcrumb} className={`text-[12px] text-muted ${className}`}>
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((c, i) => (
            <li key={c.href + i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>›</span>}
              {i === all.length - 1 ? (
                <span aria-current="page" className="text-navy">{c.name}</span>
              ) : (
                <Link href={c.href} className="hover:underline">{c.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.href) })),
        }}
      />
    </>
  );
}
