/**
 * Official Biologique Recherche logo (public/brand/br-logo.svg, from BR_LOGO_2_LINES_NEWBLUE_CMYK.ai).
 * Drawn as a CSS mask so it takes the text colour: navy in the header, white in the footer — one
 * cached file instead of 30KB of inline paths per page. Pass width and height (ratio 576.25 : 171.25 ≈ 3.365).
 * Decorative here: the surrounding link carries the accessible name.
 */
export function BrandLogo({ className = "", ...rest }: { className?: string; "data-br"?: string }) {
  return (
    <span
      {...rest}
      aria-hidden
      className={`block bg-current [mask:url(/brand/br-logo.svg)_center/contain_no-repeat] ${className}`}
    />
  );
}
