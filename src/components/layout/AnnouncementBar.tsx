"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
      className="on-dark bg-navy text-white"
      role="region"
      aria-roledescription="carousel"
      aria-label="Мэдэгдэл"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mx-auto flex h-9 max-w-[720px] items-center justify-between gap-2 px-2">
        {count > 1 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Өмнөх мэдэгдэл"
            className="grid size-8 shrink-0 place-items-center"
          >
            <ChevronLeft className="size-4" strokeWidth={1.25} aria-hidden />
          </button>
        )}
        <div className="relative h-full flex-1 overflow-hidden" aria-live={paused ? "polite" : "off"}>
          {messages.map((m, i) => (
            <p
              key={i}
              aria-hidden={i !== index}
              className={`absolute inset-0 flex items-center justify-center truncate px-2 text-center text-[12px] tracking-[0.4px] transition-all duration-500 ${
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
            aria-label="Дараагийн мэдэгдэл"
            className="grid size-8 shrink-0 place-items-center"
          >
            <ChevronRight className="size-4" strokeWidth={1.25} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
