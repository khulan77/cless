"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Img } from "@/components/ui/Img";
import { t } from "@/i18n";

type Props = {
  href: string;
  name: string;
  images: { src: string; alt: string }[];
  sizes: string;
  priority?: boolean;
};

/** Card images: ">" arrow on desktop hover, swipe on mobile; progress line at the bottom edge */
export function CardGallery({ href, name, images, sizes, priority }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  const go = (next: number) => {
    const el = trackRef.current;
    if (!el) return;
    const i = (next + count) % count;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <Link href={href} tabIndex={-1} aria-hidden className="block">
        <div
          ref={trackRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
          }}
          className="no-scrollbar flex aspect-square snap-x snap-mandatory overflow-x-auto"
        >
          {images.map((img, i) => (
            <div key={img.src + i} className="relative aspect-square w-full shrink-0 snap-start">
              <Img
                src={img.src}
                alt={i === 0 ? img.alt || t.product.image(name) : ""}
                fill
                sizes={sizes}
                priority={priority && i === 0}
                className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          ))}
        </div>
      </Link>
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={t.product.nextImage}
            className="absolute right-1 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/80 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 md:grid"
          >
            <ChevronRight className="size-4" strokeWidth={1.25} aria-hidden />
          </button>
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-navy/10">
            <div
              className="h-full bg-navy transition-[width] duration-300"
              style={{ width: `${((index + 1) / count) * 100}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
