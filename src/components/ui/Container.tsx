import type { ComponentPropsWithoutRef, ElementType } from "react";

type Props<T extends ElementType> = { as?: T } & ComponentPropsWithoutRef<T>;

/** Content max 1129px (as on biologique-recherche.com) + side padding 20px mobile / 50px desktop */
export function Container<T extends ElementType = "div">({ as, className = "", ...props }: Props<T>) {
  const Tag = as ?? "div";
  return <Tag className={`mx-auto w-full max-w-[1229px] px-5 md:px-[50px] ${className}`} {...props} />;
}
