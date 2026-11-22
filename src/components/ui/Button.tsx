import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type Tone = "navy" | "white";

const base =
  "inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-[14px] leading-none tracking-[0.2px] transition-colors duration-200";
const tones: Record<Tone, string> = {
  navy: "border-navy text-navy hover:bg-navy hover:text-white",
  white: "on-dark border-white text-white hover:bg-white hover:text-navy",
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
  return <Link className={`link-underline text-[14px] ${className}`} {...props} />;
}
