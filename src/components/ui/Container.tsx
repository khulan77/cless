import type { ComponentPropsWithoutRef, ElementType } from "react";

type Props<T extends ElementType> = {
  as?: T;
  /**
   * Image sections under the hero: "inset" 20px / 60px (the banner), "inset-wide" 25px / 60px
   * (promo cards, featured product)
   */
  pad?: "page" | "inset" | "inset-wide";
} & ComponentPropsWithoutRef<T>;

/**
 * Full width with BR's page padding: 15px on phones, 50px from tablets up — no max-width
 * (biologique-recherche.com .page-width, measured at 390/1440/1920px: docs/br-measurements.json).
 */
export function Container<T extends ElementType = "div">({ as, pad = "page", className = "", ...props }: Props<T>) {
  const Tag = as ?? "div";
  const padding = { page: "px-[15px] md:px-[50px]", inset: "px-5 md:px-[60px]", "inset-wide": "px-[25px] md:px-[60px]" }[pad];
  return <Tag className={`w-full ${padding} ${className}`} {...props} />;
}
