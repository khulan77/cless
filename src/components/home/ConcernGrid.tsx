import Link from "next/link";
import type { GridSectionSetting } from "@/lib/site-settings";
import type { CollectionTile } from "@/server/queries/catalog";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { SectionTitle } from "@/components/ui/SectionTitle";

export function ConcernGrid({ setting, concerns }: { setting: GridSectionSetting; concerns: CollectionTile[] }) {
  return (
    <Container as="section" aria-labelledby="concern-title" className="mt-16 md:mt-24">
      <SectionTitle id="concern-title">{setting.title}</SectionTitle>
      <ul className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        {concerns.map((c) => (
          <li key={c.slug}>
            <Link href={c.href} className="on-dark group relative block aspect-[3/2] overflow-hidden bg-navy">
              {c.image && (
                <Img
                  src={c.image}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              )}
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 to-transparent" />
              <span className="absolute bottom-4 left-4 right-4 text-[12px] uppercase leading-snug tracking-[0.6px] text-white md:bottom-5 md:left-5 md:text-[14px]">
                {c.heading ?? (
                  <>
                    {setting.labelPrefix && <span className="block">{setting.labelPrefix}</span>}
                    {c.name}
                  </>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
