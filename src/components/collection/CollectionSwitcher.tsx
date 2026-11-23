"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { t } from "@/i18n";
import type { CollectionLink } from "@/server/queries/catalog";

type Props = { current: CollectionLink; siblings: CollectionLink[]; parent: CollectionLink | null };

/** Listbox dropdown: siblings + "<parent> — all". Arrow keys, Enter, Esc. */
export function CollectionSwitcher({ current, siblings, parent }: Props) {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const options: CollectionLink[] = [
    ...siblings,
    ...(parent ? [{ ...parent, name: t.collection.allOf(parent.name) }] : []),
  ];
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.slug === current.slug)));
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const choose = (o: CollectionLink) => {
    setOpen(false);
    if (o.slug !== current.slug) router.push(o.href);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t.collection.switcher}: ${current.name}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-11 items-center gap-1.5 text-body uppercase tracking-[0.04em]"
      >
        {current.name}
        <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} strokeWidth={1.25} aria-hidden />
      </button>
      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Home") { e.preventDefault(); setActive(0); }
            if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
            if (e.key === "Enter" && options[active]) { e.preventDefault(); choose(options[active]); }
            if (e.key === "Escape" || e.key === "Tab") setOpen(false);
          }}
          className="absolute left-0 top-full z-30 mt-1 min-w-64 border border-line bg-white py-2 shadow-lg focus:outline-none"
        >
          {options.map((o, i) => (
            <li
              key={o.href + i}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.slug === current.slug}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
              className={`cursor-pointer px-4 py-2 text-body ${i === active ? "bg-card" : ""} ${
                o.slug === current.slug ? "underline underline-offset-4" : ""
              } ${parent && i === options.length - 1 ? "mt-1 border-t border-line pt-3" : ""}`}
            >
              {o.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
