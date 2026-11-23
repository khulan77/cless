import Link from "next/link";
import { Img } from "@/components/ui/Img";
import { realImageSrc } from "@/lib/placeholder";
import type { CollectionGridTile } from "@/server/queries/catalog";

/** Editorial cell inside the product grid; same height as neighbouring cards */
export function GridTile({ tile }: { tile: CollectionGridTile }) {
  // Text sits on the image: labelled placeholders never show (navy block instead)
  const src = realImageSrc(tile.image, { always: true });
  return (
    <article className="on-dark relative h-full min-h-[360px] overflow-hidden bg-navy text-white">
      {src && <Img src={src} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-5 md:p-6">
        {tile.eyebrow && <p className="text-micro">{tile.eyebrow}</p>}
        <h3 className="text-product">{tile.title}</h3>
        {tile.text && <p className="text-[14px] text-white/85">{tile.text}</p>}
        {tile.ctaLabel && tile.ctaHref && (
          <Link
            href={tile.ctaHref}
            className="mt-2 inline-flex rounded-full border border-white px-5 py-2.5 text-[14px] transition-colors hover:bg-white hover:text-navy"
          >
            {tile.ctaLabel}
          </Link>
        )}
      </div>
    </article>
  );
}
