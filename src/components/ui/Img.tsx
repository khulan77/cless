import Image, { type ImageProps } from "next/image";
import { SHOW_PLACEHOLDERS, isPlaceholderSrc } from "@/lib/placeholder";

/**
 * next/image wrapper. Local SVG placeholders skip the optimizer.
 * Production: dev placeholders are swapped for one quiet brand fallback (no labels).
 * When moving to Cloudinary/S3, add the domain to images.remotePatterns in next.config.
 */
export function Img({ src, alt, unoptimized, ...props }: ImageProps) {
  if (!SHOW_PLACEHOLDERS && isPlaceholderSrc(src)) return <BrandFallback fill={!!props.fill} className={props.className} width={props.width} height={props.height} />;
  const isSvg = typeof src === "string" && src.endsWith(".svg");
  return <Image src={src} alt={alt} unoptimized={unoptimized ?? isSvg} {...props} />;
}

/** Soft beige gradient with a thin line mark — used wherever an image is missing */
export function BrandFallback({ fill, className = "", width, height }: { fill?: boolean; className?: string; width?: ImageProps["width"]; height?: ImageProps["height"] }) {
  return (
    <span
      aria-hidden
      data-image-fallback
      className={`${fill ? "absolute inset-0" : "inline-block"} grid place-items-center bg-[linear-gradient(160deg,#f4f1ec_0%,#e6e0d6_100%)] ${className.replace(/\bobject-\S+/g, "")}`}
      style={fill ? undefined : { width: Number(width) || undefined, height: Number(height) || undefined }}
    >
      <svg viewBox="0 0 40 64" className="h-1/4 max-h-16 min-h-6 text-navy/15" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="12" y="2" width="16" height="10" rx="2" />
        <path d="M10 12h20v4c0 2 4 4 4 9v31a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6V25c0-5 4-7 4-9z" />
        <path d="M6 34h28" />
      </svg>
    </span>
  );
}
