import Image, { type ImageProps } from "next/image";

/**
 * next/image wrapper. Локал SVG placeholder-уудыг optimizer-ээр дамжуулахгүй.
 * Cloudinary/S3 руу шилжихэд next.config-ийн images.remotePatterns-д домэйн нэмнэ.
 */
export function Img({ src, alt, unoptimized, ...props }: ImageProps) {
  const isSvg = typeof src === "string" && src.endsWith(".svg");
  return <Image src={src} alt={alt} unoptimized={unoptimized ?? isSvg} {...props} />;
}
