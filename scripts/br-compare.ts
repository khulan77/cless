/**
 * BR vs our storefront, side by side.
 *
 *   OUR_URL=http://localhost:3000 bun scripts/br-compare.ts <out-dir>
 *
 * At 1440 and 390px it opens biologique-recherche.com/fr-fr and our home page, then writes to <out-dir>:
 *   <vp>-<section>.png   BR on the left, ours on the right (header+hero, promo, products, benefits, footer)
 *   report.html / report.md   per-element sizes, BR vs ours; |difference| > 2px is red
 * Our elements carry data-br="<name>" with the same names as docs/br-measurements.json.
 * Box sizes are compared for layout elements, font metrics for text (text widths depend on the language).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { chromium, type Browser, type Page } from "@playwright/test";
import { TARGETS, measure, settle, type Measured } from "./br-measure";

const BR_URL = "https://www.biologique-recherche.com/fr-fr";
const OUR_URL = process.env.OUR_URL ?? "http://localhost:3000";
const OUT = path.resolve(process.argv[2] ?? "br-match");
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900, mobile: false },
  { name: "390", width: 390, height: 844, mobile: true },
];

type Field = "x" | "width" | "height" | "fontSize" | "lineHeight" | "letterSpacing";
/** What to compare per element — boxes for layout, font metrics for text */
const COMPARE: [string, Field[]][] = [
  ["announcement.bar", ["height"]],
  ["announcement.prev", ["x", "width", "height"]],
  ["announcement.text", ["fontSize", "lineHeight", "letterSpacing"]],
  ["header.header", ["height"]],
  ["header.menuIcon", ["x", "width", "height"]],
  ["header.searchIcon", ["x", "width", "height"]],
  ["header.logo", ["width", "height"]],
  ["header.cartIcon", ["x", "width", "height"]],
  ["hero.section", ["height"]],
  ["hero.title", ["fontSize", "lineHeight", "letterSpacing"]],
  ["hero.link", ["fontSize", "lineHeight"]],
  // Cards, not lists: on phones the lists bleed to the window edges for swiping (cards sit where BR's do)
  ["promo.card", ["x", "width"]],
  ["promo.image", ["width", "height"]],
  ["promo.title", ["fontSize", "lineHeight"]],
  ["promo.text", ["fontSize", "lineHeight"]],
  ["promo.button", ["height", "fontSize"]],
  ["banner.grid", ["x", "width"]],
  ["banner.image", ["width", "height"]],
  ["banner.eyebrow", ["fontSize", "lineHeight"]],
  ["banner.title", ["fontSize", "lineHeight", "letterSpacing"]],
  ["banner.text", ["fontSize", "lineHeight"]],
  ["banner.link", ["fontSize", "lineHeight"]],
  ["featured.title", ["fontSize", "lineHeight", "letterSpacing"]],
  ["featured.image", ["width", "height"]],
  ["featured.card", ["width"]],
  ["products.title", ["fontSize", "lineHeight"]],
  ["card.wrapper", ["x", "width"]],
  ["card.media", ["width", "height"]],
  ["card.name", ["fontSize", "lineHeight", "letterSpacing"]],
  ["card.badge", ["fontSize", "lineHeight"]],
  ["card.priceText", ["fontSize", "lineHeight"]],
  ["card.addToCart", ["width", "height"]],
  ["guarantees.item", ["x", "width"]],
  ["guarantees.icon", ["width", "height"]],
  ["guarantees.text", ["fontSize", "lineHeight"]],
  ["footer.column", ["x", "width"]],
  ["footer.title", ["fontSize", "lineHeight"]],
  ["footer.item", ["height"]],
  ["footer.link", ["fontSize", "lineHeight"]],
  ["footer.newsletterInput", ["width", "height"]],
  ["footer.newsletterButton", ["width", "height"]],
  ["footer.socialItem", ["width", "height"]],
  ["footer.copyright", ["fontSize", "lineHeight"]],
  ["footer.legalLink", ["fontSize", "lineHeight"]],
];

/** Screenshot regions: [top element, bottom element, extra px below] */
const SECTIONS: Record<string, [string, string, number]> = {
  "header-hero": ["announcement.bar", "hero.section", 0],
  promo: ["promo.list", "promo.list", 20],
  banner: ["banner.grid", "banner.grid", 20],
  featured: ["featured.title", "featured.image", 20],
  products: ["products.title", "products.grid", 90],
  benefits: ["guarantees.list", "guarantees.list", 30],
  footer: ["footer.top", "footer.copyright", 120],
};

const NEWSLETTER = ["footer.newsletterInput", "footer.newsletterButton"];
const BR_NEWSLETTER: Record<string, string> = {
  "footer.newsletterInput": ".footer .klaviyo-form input[type='email']",
  "footer.newsletterButton": ".footer .klaviyo-form button",
};

async function open(browser: Browser, url: string, vp: (typeof VIEWPORTS)[number]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3000);
  await settle(page);
  return page;
}

/** Our product cards: the ones in the product row (the featured block above has a large card too) */
const ourSelector = (k: string) => (k.startsWith("card.") ? `[data-br="products.grid"] [data-br="${k}"]` : `[data-br="${k}"]`);

/** Expected gaps (not a mismatch): CATALOG mode has no cart button; socials come from Settings */
const EXPECTED_MISSING: Record<string, string> = {
  "card.addToCart": "CATALOG горим — сагсны товч байхгүй",
  "footer.socialItem": "Тохиргоонд сошиал холбоос хоосон",
};

async function measureBoth(br: Page, ours: Page) {
  const ourTargets = Object.fromEntries([...COMPARE.map(([k]) => k), ...Object.values(SECTIONS).flatMap(([a, b]) => [a, b])].map((k) => [k, ourSelector(k)]));
  const brTargets = { ...TARGETS };
  const [b, o] = [await measure(br, brTargets), await measure(ours, ourTargets)];
  // The newsletters render late (BR: Klaviyo) — measure them with the footer in view
  for (const p of [br, ours]) await p.evaluate(() => document.querySelector("footer")?.scrollIntoView());
  await br.waitForTimeout(3000);
  Object.assign(b, await measure(br, BR_NEWSLETTER));
  Object.assign(o, await measure(ours, Object.fromEntries(NEWSLETTER.map((k) => [k, `[data-br="${k}"]`]))));
  return { b, o };
}

const num = (m: Measured | undefined, f: Field): number | null => {
  if (!m?.rect) return null;
  if (f === "x" || f === "width" || f === "height") return m.rect[f];
  const v = m.styles?.[f];
  if (!v || v === "normal") return f === "letterSpacing" ? 0 : null;
  return Number.parseFloat(v);
};

async function region(page: Page, data: Record<string, Measured>, [top, bottom, extra]: [string, string, number], width: number) {
  const a = data[top]?.rect;
  const z = data[bottom]?.rect;
  if (!a || !z) return null;
  const y = Math.max(0, Math.floor(a.y) - 20);
  const h = Math.ceil(z.y + z.height + extra) - y;
  await page.evaluate(() => window.scrollTo(0, 0));
  const full = await page.screenshot({ fullPage: true });
  const meta = await sharp(full).metadata();
  const height = Math.min(h, (meta.height ?? 0) - y);
  if (height <= 0) return null;
  return sharp(full).extract({ left: 0, top: y, width, height }).png().toBuffer();
}

async function sideBySide(left: Buffer | null, right: Buffer | null, file: string) {
  const parts = [left, right].map((b) => (b ? sharp(b) : null));
  const metas = await Promise.all(parts.map((p) => p?.metadata()));
  const w = Math.max(...metas.map((m) => m?.width ?? 0));
  const h = Math.max(...metas.map((m) => m?.height ?? 0));
  if (!w || !h) return;
  const gap = 16;
  await sharp({ create: { width: w * 2 + gap, height: h, channels: 3, background: "#ff00ff" } })
    .composite([
      ...(left ? [{ input: left, left: 0, top: 0 }] : []),
      ...(right ? [{ input: right, left: w + gap, top: 0 }] : []),
    ])
    .png()
    .toFile(file);
}

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH || undefined });
await mkdir(OUT, { recursive: true });
const rows: { vp: string; name: string; field: Field; br: number | null; ours: number | null }[] = [];

for (const vp of VIEWPORTS) {
  const br = await open(browser, BR_URL, vp);
  const ours = await open(browser, OUR_URL, vp);
  const { b, o } = await measureBoth(br, ours);
  for (const [name, fields] of COMPARE) for (const field of fields) rows.push({ vp: vp.name, name, field, br: num(b[name], field), ours: num(o[name], field) });
  // Derived: title block distance from the hero bottom
  const heroGap = (m: Record<string, Measured>) => {
    const s = m["hero.section"]?.rect;
    const l = m["hero.link"]?.rect;
    return s && l ? Math.round((s.y + s.height - (l.y + l.height)) * 10) / 10 : null;
  };
  rows.push({ vp: vp.name, name: "hero.link → bottom", field: "height", br: heroGap(b), ours: heroGap(o) });
  for (const [section, spec] of Object.entries(SECTIONS)) {
    await sideBySide(await region(br, b, spec, vp.width), await region(ours, o, spec, vp.width), path.join(OUT, `${vp.name}-${section}.png`));
  }
  await br.context().close();
  await ours.context().close();
  console.log(`${vp.name}: done`);
}
await browser.close();

// Report
const diff = (r: (typeof rows)[number]) => (r.br === null || r.ours === null ? null : Math.round((r.ours - r.br) * 10) / 10);
const fmt = (n: number | null) => (n === null ? "—" : String(n));
const note = (r: (typeof rows)[number]) => (r.ours === null ? (EXPECTED_MISSING[r.name] ?? "") : "");
const bad = rows.filter((r) => {
  const d = diff(r);
  return d === null ? !note(r) : Math.abs(d) > 2;
});
const md = [
  `| vp | element | field | BR | ours | Δ | note |`,
  `|---|---|---|---|---|---|---|`,
  ...rows.map((r) => {
    const d = diff(r);
    const flag = d === null ? " ⚪" : Math.abs(d) > 2 ? " 🔴" : "";
    return `| ${r.vp} | ${r.name} | ${r.field} | ${fmt(r.br)} | ${fmt(r.ours)} | ${fmt(d)}${flag} | ${note(r)} |`;
  }),
].join("\n");
const html = `<!doctype html><meta charset="utf-8"><title>BR vs CLESS</title>
<style>body{font:13px system-ui;margin:24px}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:4px 8px;text-align:right}td:nth-child(-n+3){text-align:left}.bad{background:#fde2e2;color:#9b1c1c;font-weight:600}.na{color:#999}</style>
<h1>BR vs CLESS — ${new Date().toISOString().slice(0, 16)}</h1><p>${rows.length - bad.length}/${rows.length} within ±2px. Screenshots: *.png (BR left, ours right).</p>
<table><tr><th>vp</th><th>element</th><th>field</th><th>BR</th><th>ours</th><th>Δ</th><th>note</th></tr>
${rows
  .map((r) => {
    const d = diff(r);
    const cls = d === null ? "na" : Math.abs(d) > 2 ? "bad" : "";
    return `<tr class="${cls}"><td>${r.vp}</td><td>${r.name}</td><td>${r.field}</td><td>${fmt(r.br)}</td><td>${fmt(r.ours)}</td><td>${fmt(d)}</td><td>${note(r)}</td></tr>`;
  })
  .join("\n")}
</table>`;
await writeFile(path.join(OUT, "report.md"), md + "\n");
await writeFile(path.join(OUT, "report.html"), html);
console.log(`${rows.length - bad.length}/${rows.length} within ±2px → ${OUT}/report.html`);
for (const r of bad) console.log(`  ${diff(r) === null ? "⚪" : "🔴"} ${r.vp} ${r.name}.${r.field}: BR ${fmt(r.br)} / ours ${fmt(r.ours)}`);
const expected = rows.filter((r) => note(r));
if (expected.length) console.log(`Expected gaps: ${[...new Set(expected.map((r) => `${r.name} (${note(r)})`))].join("; ")}`);
