"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { t } from "@/i18n";

type Props = { messages: string[]; intervalMs: number };

export function AnnouncementBar({ messages, intervalMs }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = messages.length;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => go(1), intervalMs);
    return () => window.clearInterval(id);
  }, [count, paused, intervalMs, go]);

  if (count === 0) return null;

  return (
    <div
      data-br="announcement.bar"
      className="on-dark bg-navy text-white"
      role="region"
      aria-roledescription={t.common.slider}
      aria-label={t.layout.announcement}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* BR: arrows at the window edges (44px; 15px on phones), 30×36 buttons, 14px chevrons, 13px text */}
      <div className="flex min-h-9 items-stretch justify-between px-[15px] md:px-[44px]">
        {count > 1 && (
          <button
            type="button"
            onClick={() => go(-1)}
            data-br="announcement.prev"
            aria-label={t.layout.prevAnnouncement}
            className="relative grid w-[30px] shrink-0 place-items-center text-white/75 hover:text-white before:absolute before:-inset-x-[7px] before:inset-y-0 before:content-['']"
          >
            <ChevronLeft className="size-3.5" strokeWidth={1.5} aria-hidden />
          </button>
        )}
        {/* All messages share one grid cell: the bar is as tall as the longest (2 lines on phones) */}
        <div className="grid flex-1 overflow-hidden py-1" aria-live={paused ? "polite" : "off"}>
          {messages.map((m, i) => (
            <p
              key={i}
              aria-hidden={i !== index}
              data-br={i === index ? "announcement.text" : undefined}
              className={`col-start-1 row-start-1 flex items-center justify-center px-1 text-center text-announcement transition-all duration-500 ${
                i === index ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              }`}
            >
              {m}
            </p>
          ))}
        </div>
        {count > 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            data-br="announcement.next"
            aria-label={t.layout.nextAnnouncement}
            className="relative grid w-[30px] shrink-0 place-items-center text-white/75 hover:text-white before:absolute before:-inset-x-[7px] before:inset-y-0 before:content-['']"
          >
            <ChevronRight className="size-3.5" strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
