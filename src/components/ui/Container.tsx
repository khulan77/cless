import type { ComponentPropsWithoutRef, ElementType } from "react";

type Props<T extends ElementType> = { as?: T } & ComponentPropsWithoutRef<T>;

/** max-width 1280px content, side padding 16px (mobile) / 48px (desktop) */
export function Container<T extends ElementType = "div">({ as, className = "", ...props }: Props<T>) {
  const Tag = as ?? "div";
  return <Tag className={`mx-auto w-full max-w-[1376px] px-4 md:px-12 ${className}`} {...props} />;
}
