/**
 * Brand image file name → product (+ size). Pure; used by scripts/build-default-images.ts.
 *   "Crème_Masque_Vernix VG_50ml_RVB_MD.jpg" → { slug: "creme-masque-vernix", size: "50 мл" }
 * Matching: every word of the product name must appear in the file name (accents/case ignored);
 * the product with the most matching words wins. Nothing matched → null (reported, never guessed).
 */
export type MatchProduct = { slug: string; name: string; sizes: string[] };
export type ImageMatch = { slug: string; size: string | null; score: number };

/** Words that describe the file, not the product */
const NOISE = new Set(["rvb", "rgb", "cmjn", "cmyk", "md", "hd", "bd", "ld", "vg", "packshot", "pack", "shot", "web", "final", "copy", "img", "photo", "new", "fr", "en"]);

export function words(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !NOISE.has(w) && !/^\d+(ml|g|gr|mg)$/.test(w));
}

/** "50ml" / "50 ML" / "1.5ml" → "50 мл" */
export function sizeOf(file: string): string | null {
  const m = file.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s?(ml|gr|g)(?![a-z])/);
  if (!m) return null;
  return `${m[1]!.replace(",", ".")} ${m[2] === "ml" ? "мл" : "гр"}`;
}

export function matchImage(file: string, products: MatchProduct[]): ImageMatch | null {
  const fileWords = new Set(words(file));
  let best: ImageMatch | null = null;
  for (const p of products) {
    const nameWords = words(p.name);
    if (!nameWords.length || !nameWords.every((w) => fileWords.has(w))) continue;
    const score = nameWords.length;
    if (!best || score > best.score) {
      const size = sizeOf(file);
      best = { slug: p.slug, size: size && p.sizes.includes(size) ? size : null, score };
    }
  }
  return best;
}
