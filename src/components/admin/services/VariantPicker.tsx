"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { inputClass } from "@/components/admin/ui";
import { searchVariants, type VariantOption } from "@/server/actions/services";

/** Хайлттай combobox — сонгосон variant-ийг onSelect-ээр буцаана */
export function VariantPicker({ onSelect, exclude }: { onSelect: (v: VariantOption) => void; exclude: string[] }) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<VariantOption[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    const t = window.setTimeout(async () => {
      setLoading(true);
      const res = await searchVariants(q);
      if (id !== reqId.current) return; // хуучин хариу
      setLoading(false);
      setOptions(res.ok ? res.data.filter((o) => !exclude.includes(o.id)) : []);
      setActive(0);
    }, 200);
    return () => window.clearTimeout(t);
  }, [q, open, exclude]);

  const choose = (o: VariantOption) => {
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
        aria-label="Бүтээгдэхүүн хайх"
        value={q}
        placeholder="Бүтээгдэхүүн эсвэл SKU хайж нэмэх…"
        className={`${inputClass} w-full pl-8`}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && options[active]) { e.preventDefault(); choose(options[active]); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-white py-1 shadow-lg">
          {loading && options.length === 0 && <li className="px-3 py-2 text-[13px] text-navy/50">Хайж байна…</li>}
          {!loading && options.length === 0 && <li className="px-3 py-2 text-[13px] text-navy/50">Олдсонгүй</li>}
          {options.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-[13px] ${i === active ? "bg-navy/5" : ""}`}
            >
              {o.label} <span className="font-mono text-[11px] text-navy/45">{o.sku}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
