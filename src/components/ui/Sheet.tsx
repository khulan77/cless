"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Bottom sheet on phones, right-side panel from md up. Native <dialog> (showModal):
 * focus trap, Escape and an inert page come from the browser.
 */
export function Sheet({ open, onClose, title, closeLabel, children }: { open: boolean; onClose: () => void; title: string; closeLabel: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="sheet m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-white p-0 text-navy backdrop:bg-navy/40 md:ml-auto md:mt-0 md:h-dvh md:max-h-none md:w-[440px] md:rounded-none"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4">
        <h2 className="text-[16px] font-medium tracking-[0.2px]">{title}</h2>
        <button type="button" onClick={onClose} aria-label={closeLabel} className="-mr-2 grid size-11 place-items-center rounded-full hover:bg-navy/5">
          <X className="size-5" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
      <div className="px-5 pb-8 pt-5">{children}</div>
    </dialog>
  );
}
