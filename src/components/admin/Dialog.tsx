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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 680px instead of 480px */
  wide?: boolean;
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
      className={`m-auto ${wide ? "w-[min(680px,calc(100vw-32px))]" : "w-[min(480px,calc(100vw-32px))]"} max-h-[calc(100dvh-32px)] rounded-lg border border-line bg-white p-0 text-navy backdrop:bg-navy/30`}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="text-[15px] font-medium">{title}</h2>
        <button type="button" onClick={onClose} aria-label={t.admin.close} className="rounded p-1 hover:bg-navy/5">
          <X className="size-4" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
