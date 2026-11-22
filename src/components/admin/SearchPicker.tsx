"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { t } from "@/i18n";
import type { ActionResult } from "@/lib/action-result";
import { inputClass } from "./ui";

export type PickerOption = { id: string; label: string; hint?: string };

type Props = {
  search: (query: string) => Promise<ActionResult<PickerOption[]>>;
  onSelect: (o: PickerOption) => void;
  exclude: string[];
  label: string;
  placeholder: string;
};

/** Debounced searchable combobox (keyboard: arrows, Enter, Esc) */
export function SearchPicker({ search, onSelect, exclude, label, placeholder }: Props) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PickerOption[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const excludeKey = exclude.join(",");

  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const res = await search(q);
      if (id !== reqId.current) return; // stale response
      setLoading(false);
      const skip = new Set(excludeKey.split(","));
      setOptions(res.ok ? res.data.filter((o) => !skip.has(o.id)) : []);
      setActive(0);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [q, open, excludeKey, search]);

  const choose = (o: PickerOption) => {
    onSelect(o);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-navy/40" aria-hidden />
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={label}
        value={q}
        placeholder={placeholder}
        className={`${inputClass} w-full pl-8`}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && options[active]) { e.preventDefault(); choose(options[active]); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-white py-1 shadow-lg">
          {loading && options.length === 0 && <li className="px-3 py-2 text-[13px] text-navy/50">{t.admin.variantSearch.searching}</li>}
          {!loading && options.length === 0 && <li className="px-3 py-2 text-[13px] text-navy/50">{t.admin.variantSearch.empty}</li>}
          {options.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-[13px] ${i === active ? "bg-navy/5" : ""}`}
            >
              {o.label} {o.hint && <span className="font-mono text-[11px] text-navy/45">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
