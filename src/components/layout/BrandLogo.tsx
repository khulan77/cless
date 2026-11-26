/**
 * CLÉSS · SKIN · SPA logo (public/brand/cless-logo.png — clesslogo.png-оос тайрч, дэвсгэрийг тунгалаг болгосон).
 * Drawn as a CSS mask so it takes the text colour: navy in the header, white in the footer.
 * Pass width and height (ratio 462 : 220 = 2.1). Decorative here: the surrounding link carries the accessible name.
 */
export function BrandLogo({ className = "", ...rest }: { className?: string; "data-br"?: string }) {
  return (
    <span
      {...rest}
      aria-hidden
      className={`block bg-current [mask:url(/brand/cless-logo.png)_center/contain_no-repeat] ${className}`}
    />
  );
}
