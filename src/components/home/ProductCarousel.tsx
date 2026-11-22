"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { t } from "@/i18n";

/**
 * Horizontal carousel. Desktop: 4 columns + arrows. Mobile: 1.3 cards, swipe (scroll-snap).
 * Cards are rendered on the server and passed in as children.
 */
export function ProductCarousel({ children, label }: { children: ReactNode; label: string }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  const arrow =
    "absolute top-[38%] z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-white transition-opacity disabled:pointer-events-none disabled:opacity-0 md:grid";

  return (
    <div className="relative" role="region" aria-roledescription={t.common.slider} aria-label={label}>
      <ul
        ref={trackRef}
        onScroll={update}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-1.5 overflow-x-auto px-4 md:mx-0 md:scroll-px-0 md:px-0"
      >
        {Children.map(children, (child) => (
          <li className="w-[calc((100%-6px)/1.3)] shrink-0 snap-start sm:w-[calc((100%-6px)/2.2)] md:w-[calc((100%-18px)/4)]">
            {child}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => scrollByPage(-1)} disabled={!canPrev} aria-label={t.common.previous} className={`${arrow} -left-5`}>
        <ChevronLeft className="size-5" strokeWidth={1.25} aria-hidden />
      </button>
      <button type="button" onClick={() => scrollByPage(1)} disabled={!canNext} aria-label={t.common.next} className={`${arrow} -right-5`}>
        <ChevronRight className="size-5" strokeWidth={1.25} aria-hidden />
      </button>
    </div>
  );
}
