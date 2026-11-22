import Image, { type ImageProps } from "next/image";

/**
 * next/image wrapper. Local SVG placeholders skip the optimizer.
 * When moving to Cloudinary/S3, add the domain to images.remotePatterns in next.config.
 */
export function Img({ src, alt, unoptimized, ...props }: ImageProps) {
  const isSvg = typeof src === "string" && src.endsWith(".svg");
  return <Image src={src} alt={alt} unoptimized={unoptimized ?? isSvg} {...props} />;
}
