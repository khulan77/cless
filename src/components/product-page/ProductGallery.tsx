"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Img } from "@/components/ui/Img";
import { t } from "@/i18n";

type Image = { src: string; alt: string };

/** Main image with arrows, thumbnails, mobile swipe + progress, fullscreen zoom */
export function ProductGallery({ images, name }: { images: Image[]; name: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const count = images.length;

  const go = (i: number) => {
    const next = (i + count) % count;
    const el = trackRef.current;
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setIndex(next);
  };

  useEffect(() => {
    const el = zoomRef.current;
    if (!el) return;
    if (zoom && !el.open) el.showModal();
    if (!zoom && el.open) el.close();
  }, [zoom]);

  if (count === 0) return <div className="aspect-square bg-card" />;
  const alt = (img: Image, i: number) => img.alt || t.product.imageN(name, i + 1);
  const current = images[index];

  return (
    <div
      aria-roledescription={t.common.slider}
      aria-label={t.product.gallery}
      role="region"
      // When sticky, image + thumbnails fit the viewport (header 96px + thumbnails ~104px)
      className="lg:mx-auto lg:max-w-[max(420px,calc(100dvh-200px))]"
    >
      <div className="relative bg-card">
        <div
          ref={trackRef}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(e.currentTarget.clientWidth, 1)))}
          className="no-scrollbar flex aspect-square snap-x snap-mandatory overflow-x-auto"
        >
          {images.map((img, i) => (
            <button
              key={img.src + i}
              type="button"
              onClick={() => setZoom(true)}
              aria-label={t.product.zoom}
              className="relative aspect-square w-full shrink-0 snap-start cursor-zoom-in"
            >
              <Img
                src={img.src}
                alt={alt(img, i)}
                fill
                priority={i === 0}
                sizes="(min-width: 1024px) 56vw, 100vw"
                className="object-contain p-6 md:p-12"
              />
            </button>
          ))}
        </div>
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(index - 1)} aria-label={t.product.prevImage} className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/80 md:grid">
              <ChevronLeft className="size-5" strokeWidth={1.25} aria-hidden />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label={t.product.nextImage} className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/80 md:grid">
              <ChevronRight className="size-5" strokeWidth={1.25} aria-hidden />
            </button>
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-navy/10 md:hidden">
              <div className="h-full bg-navy transition-[width] duration-300" style={{ width: `${((index + 1) / count) * 100}%` }} />
            </div>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="mt-2 hidden gap-2 md:flex">
          {images.map((img, i) => (
            <li key={img.src + i}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={t.product.showImage(i + 1)}
                aria-current={i === index}
                className={`relative block size-20 bg-card transition-[outline-color] ${i === index ? "outline outline-1 outline-navy" : ""}`}
              >
                <Img src={img.src} alt="" fill sizes="80px" className="object-contain p-2" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={zoomRef}
        onClose={() => setZoom(false)}
        aria-label={t.product.gallery}
        inert={!zoom}
        aria-hidden={!zoom}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-card p-0 backdrop:bg-black/60"
      >
        {zoom && current && (
          <div className="relative h-full w-full">
            <Img src={current.src} alt={alt(current, index)} fill sizes="100vw" className="object-contain p-6 md:p-16" />
            <button type="button" onClick={() => setZoom(false)} aria-label={t.common.close} className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white">
              <X className="size-5" strokeWidth={1.25} aria-hidden />
            </button>
            {count > 1 && (
              <>
                <button type="button" onClick={() => go(index - 1)} aria-label={t.product.prevImage} className="absolute left-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white">
                  <ChevronLeft className="size-5" strokeWidth={1.25} aria-hidden />
                </button>
                <button type="button" onClick={() => go(index + 1)} aria-label={t.product.nextImage} className="absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white">
                  <ChevronRight className="size-5" strokeWidth={1.25} aria-hidden />
                </button>
              </>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}
