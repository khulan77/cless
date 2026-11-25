"use client";

import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { headerIconCls } from "@/components/layout/header-icon";
import { Sheet } from "@/components/ui/Sheet";
import { t } from "@/i18n";
import { ContactButtons, SalonDetails, type SalonContact } from "./ContactActions";

/**
 * "Цаг захиалах": онлайн захиалга асаалттай бол /booking (үйлчилгээ урьдчилан сонгогдоно), үгүй бол
 * залгах / мессеж, цаг, хаягтай sheet. variant: header icon, pill button or text link.
 */
export function BookingSheetButton({
  salon,
  variant = "pill",
  className = "",
  serviceSlug,
  ...rest
}: {
  salon: SalonContact;
  /** Үйлчилгээний хуудаснаас — /booking?service=… */
  serviceSlug?: string;
  variant?: "icon" | "pill" | "outline" | "link";
  className?: string;
  /** Comparison hook (scripts/br-compare.ts) */
  "data-br"?: string;
}) {
  const [open, setOpen] = useState(false);
  const cls =
    variant === "icon"
      ? headerIconCls
      : variant === "link"
        ? "link-underline text-button"
        : variant === "outline"
          ? "inline-flex min-h-12 items-center justify-center rounded-full border border-current px-6 text-button tracking-[0.4px]"
          : "inline-flex min-h-12 items-center justify-center rounded-full bg-navy px-6 text-button tracking-[0.4px] text-white hover:bg-navy/90";
  if (salon.onlineBooking) {
    return (
      <Link {...rest} href={serviceSlug ? `/booking?service=${encodeURIComponent(serviceSlug)}` : "/booking"} aria-label={variant === "icon" ? t.salon.book : undefined} className={`${cls} ${className}`}>
        {variant === "icon" ? <CalendarCheck className="size-5" strokeWidth={1.5} aria-hidden /> : t.salon.book}
      </Link>
    );
  }
  return (
    <>
      <button {...rest} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={variant === "icon" ? t.salon.book : undefined} className={`${cls} ${className}`}>
        {variant === "icon" ? <CalendarCheck className="size-5" strokeWidth={1.5} aria-hidden /> : t.salon.book}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.salon.bookTitle} closeLabel={t.salon.close}>
        <p className="mb-5 text-body text-muted">{t.salon.bookIntro}</p>
        <ContactButtons salon={salon} />
        <div className="mt-6 border-t border-line pt-5">
          <SalonDetails salon={salon} />
        </div>
      </Sheet>
    </>
  );
}
