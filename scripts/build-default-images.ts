/**
 * Default storefront images: assets-incoming/ (git-ignored originals) → public/images/defaults/ (webp).
 *
 *   bun scripts/build-default-images.ts
 *
 * Folder → section (sub-folders of assets-incoming/):
 *   hero/        2560px (+ 1920, 1280 copies), quality 85
 *   promo/ split/ featured/ salon/ services/ categories/   1600px
 *   products/ (or files in the root)   1200px, matched to products by file name
 * A product image is matched by name ("Crème_Masque_Vernix VG_50ml_RVB_MD.jpg" → creme-masque-vernix, 50 мл).
 * Writes public/images/defaults/manifest.json and prints matched / unmatched files.
 * Fails if the defaults would exceed 15MB in total. Originals are never copied into the repo.
 */
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { matchImage } from "../src/lib/image-match";
import { products } from "../prisma/seed-data/catalog";

const SRC = path.resolve("assets-incoming");
const OUT = path.resolve("public/images/defaults");
const MAX_TOTAL = 15 * 1024 * 1024;
const QUALITY = 85;
const SECTIONS = ["hero", "promo", "split", "featured", "salon", "services", "categories"] as const;
type Section = (typeof SECTIONS)[number];
const WIDTH: Record<Section | "products", number> = { hero: 2560, promo: 1600, split: 1600, featured: 1600, salon: 1600, services: 1600, categories: 1600, products: 1200 };
const IMG = /\.(jpe?g|png|webp|tiff?|avif)$/i;

export type DefaultsManifest = {
  generatedAt: string;
  totalBytes: number;
  sections: Partial<Record<Section, string[]>>;
  /** Average colour of the left/right edges (#rrggbb) — the hero "center" layout backdrop */
  colors: Record<string, string>;
  products: Record<string, { src: string; size: string | null }[]>;
  unmatched: string[];
};

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function files(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => IMG.test(f)).sort();
  } catch {
    return [];
  }
}

/** Average of the outer 2% columns on both sides */
async function edgeColor(input: string): Promise<string> {
  const { data, info } = await sharp(input).removeAlpha().resize({ width: 200 }).raw().toBuffer({ resolveWithObject: true });
  const s = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < info.height; y++)
    for (const x of [0, 1, 2, 3, info.width - 4, info.width - 3, info.width - 2, info.width - 1]) {
      const i = (y * info.width + x) * 3;
      for (let k = 0; k < 3; k++) s[k] += data[i + k];
      n++;
    }
  return "#" + s.map((v) => Math.round(v / n).toString(16).padStart(2, "0")).join("");
}

async function convert(input: string, output: string, width: number) {
  await mkdir(path.dirname(output), { recursive: true });
  const meta = await sharp(input).metadata();
  if ((meta.width ?? 0) < width) console.warn(`  ! ${path.basename(input)}: ${meta.width}px < ${width}px — бага нягтаршил`);
  await sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(output);
  return (await stat(output)).size;
}

const manifest: DefaultsManifest = { generatedAt: new Date().toISOString(), totalBytes: 0, sections: {}, colors: {}, products: {}, unmatched: [] };
await rm(OUT, { recursive: true, force: true });

for (const section of SECTIONS) {
  for (const f of await files(path.join(SRC, section))) {
    const name = slugify(f);
    const base = `/images/defaults/${section}/${name}.webp`;
    manifest.totalBytes += await convert(path.join(SRC, section, f), path.join("public", base), WIDTH[section]);
    if (section === "hero") {
      for (const w of [1920, 1280]) manifest.totalBytes += await convert(path.join(SRC, section, f), path.join(OUT, section, `${name}-${w}.webp`), w);
    }
    (manifest.sections[section] ??= []).push(base);
    if (section === "hero") manifest.colors[base] = await edgeColor(path.join(SRC, section, f));
  }
}

const catalog = products.map((p) => ({ slug: p.slug, name: p.name, sizes: p.variants.map((v) => v.size) }));
for (const [dir, list] of [[path.join(SRC, "products"), await files(path.join(SRC, "products"))], [SRC, await files(SRC)]] as const) {
  for (const f of list) {
    const m = matchImage(f, catalog);
    if (!m) {
      manifest.unmatched.push(f);
      continue;
    }
    const src = `/images/defaults/products/${m.slug}/${slugify(f)}.webp`;
    manifest.totalBytes += await convert(path.join(dir, f), path.join("public", src), WIDTH.products);
    (manifest.products[m.slug] ??= []).push({ src, size: m.size });
  }
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)}MB`;
console.log(`\nХэсгүүд: ${Object.entries(manifest.sections).map(([k, v]) => `${k} ${v.length}`).join(", ") || "—"}`);
console.log(`Бүтээгдэхүүн таарсан: ${Object.keys(manifest.products).length} бараа, ${Object.values(manifest.products).flat().length} зураг`);
for (const [slug, list] of Object.entries(manifest.products)) console.log(`  ✓ ${slug}: ${list.map((x) => x.size ?? "хэмжээгүй").join(", ")}`);
const missing = catalog.filter((p) => !manifest.products[p.slug]).map((p) => p.slug);
if (missing.length) console.log(`Зураггүй бүтээгдэхүүн (${missing.length}): ${missing.join(", ")}`);
if (manifest.unmatched.length) console.log(`Таараагүй файл (${manifest.unmatched.length}):\n  ${manifest.unmatched.join("\n  ")}`);
console.log(`Нийт: ${mb(manifest.totalBytes)} (хязгаар ${mb(MAX_TOTAL)})`);
if (manifest.totalBytes > MAX_TOTAL) {
  console.error("15MB-аас их — зургийн тоо эсвэл чанарыг багасгана уу.");
  process.exit(1);
}
