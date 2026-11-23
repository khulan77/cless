"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export type AccordionItem = { id: string; title: string; content: ReactNode };

/** One panel open at a time; first open by default; smooth height via grid rows */
export function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  const base = useId();
  return (
    <div className="mt-10 border-t border-line">
      {items.map((item) => {
        const isOpen = open === item.id;
        const btn = `${base}-${item.id}-btn`;
        const panel = `${base}-${item.id}-panel`;
        return (
          <section key={item.id} className="border-b border-line">
            <h2>
              <button
                id={btn}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panel}
                onClick={() => setOpen(isOpen ? null : item.id)}
                className="flex w-full items-center justify-between py-4 text-left text-meta uppercase tracking-[0.06em]"
              >
                {item.title}
                {isOpen ? <Minus className="size-4" strokeWidth={1.25} aria-hidden /> : <Plus className="size-4" strokeWidth={1.25} aria-hidden />}
              </button>
            </h2>
            <div
              id={panel}
              role="region"
              aria-labelledby={btn}
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden" inert={!isOpen}>
                <div className="pb-6 text-body leading-relaxed">{item.content}</div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
