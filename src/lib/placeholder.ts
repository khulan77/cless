/**
 * Dev placeholders in /public/placeholders carry labels ("HERO IMAGE · 1920×1080") meant for
 * the team. They must never reach visitors: production builds treat them as "no image".
 */
export const SHOW_PLACEHOLDERS = process.env.NODE_ENV !== "production";

export function isPlaceholderSrc(src: unknown): boolean {
  return typeof src === "string" && src.startsWith("/placeholders/");
}

/** Real image or null. `always` — slots with text on top hide placeholders in dev as well. */
export function realImageSrc(src: string | null | undefined, opts: { always?: boolean } = {}): string | null {
  if (!src) return null;
  if (isPlaceholderSrc(src) && (opts.always || !SHOW_PLACEHOLDERS)) return null;
  return src;
}
