"use client";

import { CalendarCheck } from "lucide-react";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { t } from "@/i18n";
import { ContactButtons, SalonDetails, type SalonContact } from "./ContactActions";

/**
 * "Цаг захиалах" — online booking does not exist (reception books), so the sheet offers
 * call / DM, hours and address. variant: header icon, pill button or text link.
 */
export function BookingSheetButton({ salon, variant = "pill", className = "" }: { salon: SalonContact; variant?: "icon" | "pill" | "outline" | "link"; className?: string }) {
  const [open, setOpen] = useState(false);
  const cls =
    variant === "icon"
      ? "grid size-11 place-items-center"
      : variant === "link"
        ? "link-underline text-[14px]"
        : variant === "outline"
          ? "inline-flex min-h-12 items-center justify-center rounded-full border border-current px-6 text-[14px] tracking-[0.4px]"
          : "inline-flex min-h-12 items-center justify-center rounded-full bg-navy px-6 text-[14px] tracking-[0.4px] text-white hover:bg-navy/90";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={variant === "icon" ? t.salon.book : undefined} className={`${cls} ${className}`}>
        {variant === "icon" ? <CalendarCheck className="size-[22px]" strokeWidth={1.25} aria-hidden /> : t.salon.book}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.salon.bookTitle} closeLabel={t.salon.close}>
        <p className="mb-5 text-[14px] text-muted">{t.salon.bookIntro}</p>
        <ContactButtons salon={salon} />
        <div className="mt-6 border-t border-line pt-5">
          <SalonDetails salon={salon} />
        </div>
      </Sheet>
    </>
  );
}
