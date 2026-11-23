/**
 * Default storefront images built by scripts/build-default-images.ts (public/images/defaults/manifest.json).
 * Admin can replace any of them; "Үндсэн рүү буцаах" puts the default back.
 */
import manifest from "../../public/images/defaults/manifest.json";

type Manifest = {
  sections: Partial<Record<"hero" | "promo" | "split" | "featured" | "salon" | "services" | "categories", string[]>>;
  colors?: Record<string, string>;
  products: Record<string, { src: string; size: string | null }[]>;
};
const m = manifest as unknown as Manifest;

/** "hero", "promo.1", "split", "featured", "salon", "services", "categories.2" → default src or null */
export function defaultImage(slot: string): string | null {
  const [section, index] = slot.split(".") as [keyof Manifest["sections"], string | undefined];
  return m.sections[section]?.[Number(index ?? 0)] ?? null;
}

/** Edge colour of a default image (hero "center" backdrop) */
export function defaultImageColor(slot: string): string | null {
  const src = defaultImage(slot);
  return (src && m.colors?.[src]) ?? null;
}

export function defaultProductImages(slug: string): { src: string; size: string | null }[] {
  return m.products[slug] ?? [];
}

export const isDefaultImage = (src: string | null | undefined) => Boolean(src?.startsWith("/images/defaults/"));
