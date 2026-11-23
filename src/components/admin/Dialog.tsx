"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { t } from "@/i18n";

/** Native <dialog> — the browser handles focus trap, Escape and backdrop */
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
  badge,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 760px instead of 520px */
  wide?: boolean;
  /** Shown next to the title (e.g. status) */
  badge?: ReactNode;
  /** Sticky action row at the bottom */
  footer?: ReactNode;
}) {
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
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto ${wide ? "w-[min(760px,calc(100vw-32px))]" : "w-[min(520px,calc(100vw-32px))]"} max-h-[calc(100dvh-48px)] max-w-none overflow-hidden rounded-[20px] border border-hairline bg-white p-0 font-[family-name:var(--font-admin-sans)] text-ink shadow-[0_24px_64px_rgba(14,34,67,0.18)] backdrop:bg-navy/35 open:flex open:flex-col`}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 px-7 pb-2 pt-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h2 className="font-display text-[26px] font-semibold leading-tight">{title}</h2>
          {badge}
        </div>
        <button type="button" onClick={onClose} aria-label={t.admin.close} className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-xl text-ink-soft hover:bg-ink/[0.05] hover:text-ink">
          <X className="size-5" strokeWidth={1.75} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6 pt-3">{children}</div>
      {footer && <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-hairline bg-canvas/60 px-7 py-4">{footer}</div>}
    </dialog>
  );
}
