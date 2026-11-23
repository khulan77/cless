import { Clock } from "lucide-react";
import Link from "next/link";
import { Img } from "@/components/ui/Img";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { realImageSrc } from "@/lib/placeholder";
import type { PublicService } from "@/server/queries/catalog";

export function servicePrice(s: Pick<PublicService, "price" | "priceFrom">) {
  return s.priceFrom ? t.pages.services.priceFrom(formatMNT(s.price)) : formatMNT(s.price);
}

export function ServiceCard({ service: s, headingLevel = "h3" }: { service: PublicService; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  const src = realImageSrc(s.image);
  return (
    <li className="group relative flex flex-col bg-card sm:flex-row">
      {src && (
        <div className="relative aspect-[4/3] sm:aspect-auto sm:w-48 sm:shrink-0">
          <Img src={src} alt="" fill sizes="(min-width: 640px) 192px, 100vw" className="object-cover" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <H className="text-product">
          <Link href={`/services/${s.slug}`} className="after:absolute after:inset-0 group-hover:underline">
            {s.name}
          </Link>
        </H>
        <p className="mt-2 line-clamp-3 flex-1 text-body text-muted">{s.shortDescription || s.description}</p>
        <div className="mt-4 flex items-center justify-between gap-3 text-body">
          <span className="flex items-center gap-1.5 text-muted">
            <Clock className="size-4" strokeWidth={1.25} aria-hidden /> {t.pages.services.minutes(s.durationMin)}
          </span>
          <span className="text-price">{servicePrice(s)}</span>
        </div>
      </div>
    </li>
  );
}
