import Link from "next/link";
import type { GridSectionSetting } from "@/lib/site-settings";
import type { CollectionTile } from "@/server/queries/catalog";
import { Container } from "@/components/ui/Container";
import { Img } from "@/components/ui/Img";
import { SectionTitle } from "@/components/ui/SectionTitle";

export function CategoryGrid({ setting, categories }: { setting: GridSectionSetting; categories: CollectionTile[] }) {
  return (
    <Container as="section" aria-labelledby="category-title" className="mt-16 md:mt-24">
      <SectionTitle id="category-title">{setting.title}</SectionTitle>
      <ul className="grid grid-cols-2 gap-x-1.5 gap-y-8 md:grid-cols-4">
        {categories.map((c) => (
          <li key={c.slug}>
            <Link href={c.href} className="group block">
              <div className="relative aspect-square overflow-hidden bg-card">
                {c.image && (
                  <Img
                    src={c.image}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
              </div>
              <p className="text-product mt-4 text-center text-[15px] md:text-[17px]">{c.name}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
