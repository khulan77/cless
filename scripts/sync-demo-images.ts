/**
 * Copy the IMAGE fields of the local DB onto the demo DB (Supabase), so the deployed demo shows the
 * same pictures as local. Nothing else is touched.
 *
 *   bun scripts/sync-demo-images.ts            # dry run: lists every change, writes nothing
 *   bun scripts/sync-demo-images.ts --apply    # one transaction
 *
 * Source: DATABASE_URL (local .env). Target: DIRECT_URL (else DATABASE_URL) read from .env.demo.
 * Matching: SiteSetting by key (+ JSON path), Collection / Service by slug, CollectionTile by
 * collection slug + position, ProductImage by product slug (the set is replaced as a whole).
 *
 * Fields: SiteSetting "image"/"mobileImage" objects anywhere in the JSON, plus the hero's picture
 * presentation (focal, layout, background, headerTone); Collection.bannerImage / tileImage;
 * CollectionTile.image; Service.image; ProductImage rows (url, alt, sortOrder).
 * /uploads/x is rewritten to /images/demo/x (files committed under public/images/demo/).
 * Every path written must exist under public/ (or be a /placeholders/ path) — otherwise the run stops.
 * Values are never printed with credentials; only hosts and image paths are shown.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const APPLY = process.argv.includes("--apply");

function readEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

const localUrl = process.env.DATABASE_URL;
const demoEnv = readEnvFile(".env.demo");
const demoUrl = demoEnv.DIRECT_URL || demoEnv.DATABASE_URL;
if (!localUrl || !demoUrl) throw new Error("DATABASE_URL (.env) and DIRECT_URL/DATABASE_URL (.env.demo) are required");
const host = (u: string) => {
  const x = new URL(u);
  return `${x.hostname}:${x.port || 5432}${x.pathname}`;
};
if (host(localUrl) === host(demoUrl)) throw new Error("Source and target are the same database");

/** /uploads/x → /images/demo/x; everything else unchanged */
const mapPath = (p: string) => (p.startsWith("/uploads/") ? `/images/demo/${p.slice("/uploads/".length)}` : p);
const missing = new Set<string>();
function checked(p: string | null): string | null {
  if (p === null || p === "") return p;
  const mapped = mapPath(p);
  if (!mapped.startsWith("/placeholders/") && !existsSync(path.join("public", mapped))) missing.add(mapped);
  return mapped;
}

type Change = { what: string; from: string; to: string; sql: string; params: unknown[] };
const changes: Change[] = [];
const show = (v: unknown) => (v === null || v === undefined ? "∅" : typeof v === "string" ? v : JSON.stringify(v));

// ── SiteSetting: image subtrees by JSON path ──
const HERO_PRESENTATION = ["focal", "layout", "background", "headerTone"] as const;
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function mapImages(v: Json): Json {
  if (Array.isArray(v)) return v.map(mapImages);
  if (v && typeof v === "object") {
    const o: { [k: string]: Json } = {};
    for (const [k, x] of Object.entries(v)) o[k] = k === "src" && typeof x === "string" ? checked(x) : mapImages(x);
    return o;
  }
  return v;
}

/** Collect [jsonPath, value] for every image field in a setting value */
function imageFields(v: Json, key: string, at: (string | number)[] = []): [(string | number)[], Json][] {
  const out: [(string | number)[], Json][] = [];
  if (Array.isArray(v)) v.forEach((x, i) => out.push(...imageFields(x, key, [...at, i])));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      if (k === "image" || k === "mobileImage") out.push([[...at, k], x]);
      else if (key === "hero" && at.length === 0 && (HERO_PRESENTATION as readonly string[]).includes(k)) out.push([[k], x]);
      else out.push(...imageFields(x, key, [...at, k]));
    }
  return out;
}

function getAt(v: Json, p: (string | number)[]): Json | undefined {
  let cur: Json | undefined = v;
  for (const k of p) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, Json>)[k as never];
  }
  return cur;
}
function setAt(v: Json, p: (string | number)[], value: Json): void {
  let cur = v as Record<string | number, Json>;
  for (const k of p.slice(0, -1)) cur = cur[k as never] as Record<string | number, Json>;
  cur[p[p.length - 1] as never] = value;
}

const local = new pg.Client({ connectionString: localUrl, options: "-c TimeZone=UTC" });
const demo = new pg.Client({ connectionString: demoUrl });
await local.connect();
await demo.connect();
console.log(`source (local): ${host(localUrl)}`);
console.log(`target (demo):  ${host(demoUrl)}`);
console.log(APPLY ? "Mode: APPLY (one transaction)\n" : "Mode: dry run — nothing is written\n");

try {
  // SiteSetting
  const [ls, ds] = await Promise.all([
    local.query<{ key: string; value: Json }>(`SELECT "key", "value" FROM "SiteSetting"`),
    demo.query<{ key: string; value: Json }>(`SELECT "key", "value" FROM "SiteSetting"`),
  ]);
  const demoSettings = new Map(ds.rows.map((r) => [r.key, r.value]));
  for (const { key, value } of ls.rows) {
    const target = demoSettings.get(key);
    if (target === undefined) continue; // the demo has no such setting — not ours to create
    const next = structuredClone(target);
    const diffs: string[] = [];
    for (const [p, localValue] of imageFields(value, key)) {
      const parent = getAt(target, p.slice(0, -1));
      if (parent === undefined || parent === null || typeof parent !== "object") {
        diffs.push(`  ! ${p.join(".")}: no such place in the demo value — skipped`);
        continue;
      }
      const want = mapImages(localValue);
      const have = getAt(target, p);
      if (JSON.stringify(have) === JSON.stringify(want)) continue;
      setAt(next, p, want);
      diffs.push(`  ${p.join(".")}: ${show(have)} → ${show(want)}`);
    }
    const real = diffs.filter((d) => !d.startsWith("  !"));
    if (diffs.length) console.log(`SiteSetting "${key}"\n${diffs.join("\n")}`);
    if (real.length)
      changes.push({
        what: `SiteSetting ${key} (${real.length} field${real.length > 1 ? "s" : ""})`,
        from: "",
        to: "",
        sql: `UPDATE "SiteSetting" SET "value" = $2::jsonb, "updatedAt" = now() WHERE "key" = $1`,
        params: [key, JSON.stringify(next)],
      });
  }

  // Collection banner / tile images
  const [lc, dc] = await Promise.all([
    local.query<{ slug: string; bannerImage: string | null; tileImage: string | null }>(`SELECT "slug", "bannerImage", "tileImage" FROM "Collection"`),
    demo.query<{ slug: string; bannerImage: string | null; tileImage: string | null }>(`SELECT "slug", "bannerImage", "tileImage" FROM "Collection"`),
  ]);
  const demoCollections = new Map(dc.rows.map((r) => [r.slug, r]));
  for (const c of lc.rows) {
    const d = demoCollections.get(c.slug);
    if (!d) continue;
    for (const field of ["bannerImage", "tileImage"] as const) {
      const want = checked(c[field]);
      if (want !== d[field])
        changes.push({ what: `Collection ${c.slug}.${field}`, from: show(d[field]), to: show(want), sql: `UPDATE "Collection" SET "${field}" = $2 WHERE "slug" = $1`, params: [c.slug, want] });
    }
  }

  // CollectionTile.image (collection slug + position)
  const tileSql = `SELECT c."slug", t."position", t."image" FROM "CollectionTile" t JOIN "Collection" c ON c."id" = t."collectionId"`;
  const [lt, dt] = await Promise.all([local.query<{ slug: string; position: number; image: string }>(tileSql), demo.query<{ slug: string; position: number; image: string }>(tileSql)]);
  const demoTiles = new Map(dt.rows.map((r) => [`${r.slug}#${r.position}`, r]));
  for (const t of lt.rows) {
    const d = demoTiles.get(`${t.slug}#${t.position}`);
    const want = checked(t.image);
    if (d && want !== d.image)
      changes.push({
        what: `CollectionTile ${t.slug}#${t.position}`,
        from: show(d.image),
        to: show(want),
        sql: `UPDATE "CollectionTile" SET "image" = $3 WHERE "position" = $2 AND "collectionId" = (SELECT "id" FROM "Collection" WHERE "slug" = $1)`,
        params: [t.slug, t.position, want],
      });
  }

  // Service.image
  const [lsv, dsv] = await Promise.all([
    local.query<{ slug: string; image: string | null }>(`SELECT "slug", "image" FROM "Service"`),
    demo.query<{ slug: string; image: string | null }>(`SELECT "slug", "image" FROM "Service"`),
  ]);
  const demoServices = new Map(dsv.rows.map((r) => [r.slug, r]));
  for (const s of lsv.rows) {
    const d = demoServices.get(s.slug);
    const want = checked(s.image);
    if (d && want !== d.image) changes.push({ what: `Service ${s.slug}.image`, from: show(d.image), to: show(want), sql: `UPDATE "Service" SET "image" = $2 WHERE "slug" = $1`, params: [s.slug, want] });
  }

  // ProductImage: the whole set per product slug
  const imgSql = `SELECT p."slug", i."url", i."alt", i."sortOrder" FROM "ProductImage" i JOIN "Product" p ON p."id" = i."productId" ORDER BY p."slug", i."sortOrder", i."url"`;
  const [lpi, dpi, dprod] = await Promise.all([
    local.query<{ slug: string; url: string; alt: string; sortOrder: number }>(imgSql),
    demo.query<{ slug: string; url: string; alt: string; sortOrder: number }>(imgSql),
    demo.query<{ slug: string }>(`SELECT "slug" FROM "Product"`),
  ]);
  const group = (rows: { slug: string; url: string; alt: string; sortOrder: number }[]) => {
    const m = new Map<string, { url: string; alt: string; sortOrder: number }[]>();
    for (const r of rows) (m.get(r.slug) ?? m.set(r.slug, []).get(r.slug)!).push({ url: r.url, alt: r.alt, sortOrder: r.sortOrder });
    return m;
  };
  const localImgs = group(lpi.rows);
  const demoImgs = group(dpi.rows);
  const demoProducts = new Set(dprod.rows.map((r) => r.slug));
  for (const [slug, imgs] of localImgs) {
    if (!demoProducts.has(slug)) continue;
    const want = imgs.map((i) => ({ ...i, url: checked(i.url)! }));
    const have = demoImgs.get(slug) ?? [];
    if (JSON.stringify(want) === JSON.stringify(have)) continue;
    changes.push({
      what: `ProductImage ${slug} (${have.length} → ${want.length})`,
      from: have.map((i) => i.url).join(", ") || "∅",
      to: want.map((i) => i.url).join(", "),
      sql: `WITH p AS (SELECT "id" FROM "Product" WHERE "slug" = $1), d AS (DELETE FROM "ProductImage" WHERE "productId" = (SELECT "id" FROM p))
            INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "sortOrder")
            SELECT 'demo-' || md5($1 || e.ord::text || (e.x->>'url')), (SELECT "id" FROM p), e.x->>'url', e.x->>'alt', (e.x->>'sortOrder')::int
            FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS e(x, ord)`,
      params: [slug, JSON.stringify(want)],
    });
  }

  // Report
  const rows = changes.filter((c) => c.from !== "" || c.to !== "");
  for (const c of rows) console.log(`${c.what}\n  ${c.from} → ${c.to}`);
  if (missing.size) {
    console.error(`\n✖ ${missing.size} image path(s) do not exist under public/ — nothing written:`);
    for (const m of missing) console.error(`  ${m}`);
    process.exitCode = 1;
  } else {
    console.log(`\n${changes.length} row(s) to update.`);
    if (APPLY && changes.length) {
      await demo.query("BEGIN");
      try {
        let n = 0;
        for (const c of changes) n += (await demo.query(c.sql, c.params)).rowCount ?? 0;
        await demo.query("COMMIT");
        console.log(`✓ Applied: ${changes.length} change(s), ${n} row(s) written.`);
      } catch (e) {
        await demo.query("ROLLBACK");
        throw e;
      }
    } else if (!APPLY) console.log("Dry run — run with --apply to write.");
  }
} finally {
  await local.end();
  await demo.end();
}
