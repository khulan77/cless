import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type Tone = "navy" | "white" | "soft";

// BR sizes (docs/br-measurements.json): outline pill 46px tall, 14px text ("Voir tout");
// soft pill 40px, 13px text, white with a 1px #c4c8ce inset ring (promo cards)
const base =
  "relative inline-flex items-center justify-center rounded-full transition-[color,background-color,box-shadow] duration-200 before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']";
const tones: Record<Tone, string> = {
  navy: "h-[46px] border border-navy bg-white px-[30px] text-button-lg text-navy hover:bg-navy hover:text-white",
  white: "on-dark h-[46px] border border-white px-[30px] text-button-lg text-white hover:bg-white hover:text-navy",
  soft: "h-10 bg-white px-[15px] text-button text-navy shadow-[inset_0_0_0_1px_#c4c8ce] hover:shadow-[inset_0_0_0_1px_var(--color-navy)]",
};

export function pillClass(tone: Tone = "navy", className = "") {
  return `${base} ${tones[tone]} ${className}`;
}

/** Pill outline button rendered as a link */
export function PillLink({
  tone = "navy",
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Link> & { tone?: Tone }) {
  return <Link className={pillClass(tone, className)} {...props} />;
}

/** Pill outline button */
export function PillButton({
  tone = "navy",
  className,
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button"> & { tone?: Tone }) {
  return <button type={type} className={pillClass(tone, className)} {...props} />;
}

/** Underlined text link */
export function TextLink({ className = "", ...props }: ComponentPropsWithoutRef<typeof Link>) {
  return <Link className={`link-underline relative text-button before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] ${className}`} {...props} />;
}
