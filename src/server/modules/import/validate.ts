/**
 * Импортын төлөвлөгөө: мөрүүд + DB-ийн одоогийн төлөв → бүтээгдэхүүн тус бүрийн
 * ProductInput (saveProduct-д шууд өгөх) ба шинэ/шинэчлэгдэх/өөрчлөлтгүй/алдаатай ангилал.
 *
 * DB-гүй цэвэр функц (контекстыг service.ts бэлдэнэ) — unit test хийгдэнэ.
 *
 * Байгаа бүтээгдэхүүнийг шинэчлэх дүрэм ("хоосон = өөрчлөхгүй"):
 *  - Excel-ийн хоосон нүд одоогийн утгыг хадгална; Excel-д байхгүй талбар (SEO, холбоос, багц,
 *    байгаль орчин, клиник тэмдэглэл, дараалал) хэвээр.
 *  - Excel-д байхгүй хувилбарууд хэвээр (saveProduct илгээгээгүй хувилбарыг архивлах тул бүгдийг дамжуулна).
 *  - Зураг: бүтээгдэхүүнд зураг байхгүй үед л нэмнэ (давтан импорт давхардуулахгүй).
 */
import { infra } from "@/i18n/mn.infra";
import { productInputSchema, type ProductInput } from "@/lib/validation/product";
import {
  BADGE_INPUT,
  EXAMPLE_SLUG_PREFIX,
  FALSE_WORDS,
  MAX_IMAGES_PER_PRODUCT,
  PRODUCT_COLUMNS,
  PRODUCT_SHEET,
  TRUE_WORDS,
  VARIANT_COLUMNS,
  VARIANT_SHEET,
  type ProductColumn,
  type VariantColumn,
} from "./columns";
import type { ParsedWorkbook, RawRow } from "./parse";

const E = infra.import.err;
const W = infra.import.warn;

type Badge = NonNullable<ProductInput["badge"]>;
type RelationType = ProductInput["relations"][number]["type"];

/** DB-д байгаа бүтээгдэхүүн (service.ts уншина) */
export type ExistingProduct = {
  id: string;
  slug: string;
  name: string;
  kind: "SINGLE" | "BUNDLE";
  tagline: string | null;
  recommendedFor: string | null;
  benefits: string[];
  description: string;
  skinScience: string | null;
  howToUse: string[];
  ingredients: string | null;
  environmental: Record<string, string>;
  clinicalNotes: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  badge: Badge | null;
  isPublished: boolean;
  sortOrder: number;
  images: { id: string; url: string; alt: string }[];
  /** sortOrder-оор эрэмбэлсэн */
  variants: { id: string; sku: string; size: string; price: number; costPrice: number; lowStockAt: number; isActive: boolean }[];
  collectionIds: string[];
  relations: { relatedId: string; type: RelationType }[];
  bundleItems: { variantId: string; qty: number }[];
};

export type ImportContext = {
  collections: { id: string; slug: string; kind: "CATEGORY" | "CONCERN" }[];
  /** slug → бүтээгдэхүүн (Excel-д байгаа slug-уудаар) */
  products: Map<string, ExistingProduct>;
  /** SKU → эзэмшигч бүтээгдэхүүний slug (Excel-д байгаа SKU-уудаар) */
  skuOwners: Map<string, string>;
};

export type ProductAction = "create" | "update" | "unchanged" | "error";

export type PlannedVariant = {
  row: number;
  sku: string;
  size: string;
  price: number | null;
  action: "create" | "update" | "unchanged";
  /** Зөвхөн шинэ хувилбарт > 0 */
  initialStock: number;
  costPrice: number;
};

export type PlannedProduct = {
  row: number;
  slug: string;
  name: string;
  action: ProductAction;
  errors: string[];
  warnings: string[];
  variants: PlannedVariant[];
  /** Татах зургийн URL (эсвэл локал /uploads/… зам) */
  imageUrls: string[];
  /** create/update үед saveProduct-д өгөх оролт (зураг нэмэгдээгүй) */
  input?: ProductInput;
};

export type ImportPlan = {
  errors: string[];
  products: PlannedProduct[];
  summary: Record<ProductAction, number>;
  canImport: boolean;
};

// ─────────────────────────── туслахууд ───────────────────────────

const label = <K extends string>(cols: { key: K; header: string }[], key: K) => cols.find((c) => c.key === key)!.header;
const pLabel = (k: ProductColumn) => label(PRODUCT_COLUMNS, k);
const vLabel = (k: VariantColumn) => label(VARIANT_COLUMNS, k);
const pRow = (n: number) => E.row(PRODUCT_SHEET, n);
const vRow = (n: number) => E.row(VARIANT_SHEET, n);

/** "a; b ;; c" эсвэл мөр шилжилтээр → ["a","b","c"] */
export const splitList = (s: string) =>
  s
    .split(/[;\n\r]+/)
    .map((x) => x.trim())
    .filter(Boolean);

/** "185,000₮" / "185 000" / 185000 → 185000; хоосон → null; буруу → NaN */
export function parseIntCell(s: string): number | null {
  const c = s.replace(/[\s,'₮]/g, "").replace(/^(-?\d+)\.0+$/, "$1");
  if (!c) return null;
  return /^-?\d+$/.test(c) ? Number.parseInt(c, 10) : Number.NaN;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("\0") === [...b].sort().join("\0");
const sameList = (a: string[], b: string[]) => a.join("\0") === b.join("\0");

/** zod-ийн path → Excel мөр, баганын нэр */
function issueToMessage(path: PropertyKey[], msg: string, productRow: number, variantRows: number[]): string {
  const [head, idx, sub] = path;
  if (head === "variants" && typeof idx === "number") {
    const key = sub as VariantColumn | "lowStockAt" | undefined;
    const lbl = key && VARIANT_COLUMNS.some((c) => c.key === key) ? vLabel(key as VariantColumn) : vLabel("sku");
    return E.field(vRow(variantRows[idx] ?? productRow), lbl, msg);
  }
  if (head === "variants") return E.field(pRow(productRow), VARIANT_SHEET, msg);
  const key = String(head) as ProductColumn;
  const lbl = PRODUCT_COLUMNS.some((c) => c.key === key) ? pLabel(key) : String(head);
  return E.field(pRow(productRow), lbl, msg);
}

// ─────────────────────────── үндсэн функц ───────────────────────────

export function buildImportPlan(parsed: ParsedWorkbook, ctx: ImportContext): ImportPlan {
  const errors = [...parsed.errors];

  // ── Хувилбаруудыг slug-аар бүлэглэх + SKU давхардал
  const productSlugs = new Set(parsed.products.map((p) => p.values.slug.trim().toLowerCase()));
  const variantsBySlug = new Map<string, RawRow<VariantColumn>[]>();
  const skuFirstRow = new Map<string, number>();
  const variantRowErrors = new Map<number, string[]>();
  const addVErr = (row: number, msg: string) => variantRowErrors.set(row, [...(variantRowErrors.get(row) ?? []), msg]);

  for (const v of parsed.variants) {
    const slug = v.values.productSlug.trim().toLowerCase();
    const sku = v.values.sku.trim().toUpperCase();
    if (sku) {
      const first = skuFirstRow.get(sku);
      if (first !== undefined) addVErr(v.row, E.dupSku(vRow(v.row), sku, first));
      else skuFirstRow.set(sku, v.row);
    }
    if (!slug) {
      addVErr(v.row, E.required(vRow(v.row), vLabel("productSlug")));
      errors.push(...(variantRowErrors.get(v.row) ?? []));
      continue;
    }
    if (!productSlugs.has(slug)) {
      errors.push(E.unknownProduct(vRow(v.row), slug), ...(variantRowErrors.get(v.row) ?? []));
      continue;
    }
    variantsBySlug.set(slug, [...(variantsBySlug.get(slug) ?? []), v]);
  }

  // ── Бүтээгдэхүүн тус бүр
  const slugFirstRow = new Map<string, number>();
  const collectionBySlug = new Map(ctx.collections.map((c) => [c.slug, c]));
  const collectionKind = new Map(ctx.collections.map((c) => [c.id, c.kind]));

  const products: PlannedProduct[] = parsed.products.map((p) => {
    const r = pRow(p.row);
    const val = p.values;
    const slug = val.slug.trim().toLowerCase();
    const errs: string[] = [];
    const warns: string[] = [];

    const first = slug ? slugFirstRow.get(slug) : undefined;
    if (first !== undefined) errs.push(E.dupSlug(r, slug, first));
    else if (slug) slugFirstRow.set(slug, p.row);
    if (slug.startsWith(EXAMPLE_SLUG_PREFIX)) errs.push(E.exampleRow(r));

    const existing = slug ? ctx.products.get(slug) : undefined;
    const name = val.name.trim();
    if (name && /[Ѐ-ӿ]/.test(name)) warns.push(W.notLatin(r));

    // badge
    let badge: Badge | null | undefined;
    const badgeRaw = val.badge.trim().toLowerCase().replace(/\s+/g, " ");
    if (badgeRaw) {
      badge = BADGE_INPUT[badgeRaw] ?? BADGE_INPUT[badgeRaw.replace(/ /g, "_")];
      if (!badge) errs.push(E.badBadge(r, val.badge));
    }
    // нийтлэх
    let isPublished: boolean | undefined;
    const pubRaw = val.isPublished.trim().toLowerCase();
    if (pubRaw) {
      if (TRUE_WORDS.has(pubRaw)) isPublished = true;
      else if (FALSE_WORDS.has(pubRaw)) isPublished = false;
      else errs.push(E.badBool(r, val.isPublished));
    }
    // ангилал / арьсны асуудал
    const resolveCollections = (raw: string, kind: "CATEGORY" | "CONCERN") => {
      const ids: string[] = [];
      for (const s of splitList(raw.toLowerCase())) {
        const c = collectionBySlug.get(s);
        if (!c || c.kind !== kind) errs.push(kind === "CATEGORY" ? E.unknownCategory(r, s) : E.unknownConcern(r, s));
        else ids.push(c.id);
      }
      return [...new Set(ids)];
    };
    const categoryIds = val.categories.trim() ? resolveCollections(val.categories, "CATEGORY") : undefined;
    const concernIds = val.concerns.trim() ? resolveCollections(val.concerns, "CONCERN") : undefined;
    // зураг
    const imageUrls = [...new Set(splitList(val.images))];
    if (imageUrls.length > MAX_IMAGES_PER_PRODUCT) errs.push(E.tooManyImages(r, MAX_IMAGES_PER_PRODUCT));
    for (const u of imageUrls) {
      if (!/^https?:\/\/[^\s]+$/i.test(u) && !/^\/uploads\/[\w./-]+$/.test(u)) errs.push(E.badImageUrl(r, u));
    }

    // ── Хувилбарууд
    const vRows = variantsBySlug.get(slug) ?? [];
    if (first !== undefined) vRows.length = 0; // давхар slug-ийн хоёр дахь мөрөнд хувилбар оноохгүй
    const planned: PlannedVariant[] = [];
    const variantInputs: ProductInput["variants"] = [];
    const variantInputRows: number[] = [];
    const existingBySku = new Map((existing?.variants ?? []).map((v) => [v.sku, v]));

    for (const v of vRows) {
      const vr = vRow(v.row);
      errs.push(...(variantRowErrors.get(v.row) ?? []));
      const sku = v.values.sku.trim().toUpperCase();
      const size = v.values.size.trim();
      const price = parseIntCell(v.values.price);
      const cost = parseIntCell(v.values.costPrice);
      const stock = parseIntCell(v.values.initialStock);
      const low = parseIntCell(v.values.lowStockAt);
      if (!sku) errs.push(E.required(vr, vLabel("sku")));
      if (!size) errs.push(E.required(vr, vLabel("size")));
      if (price === null) errs.push(E.required(vr, vLabel("price")));
      for (const [n, k] of [[price, "price"], [cost, "costPrice"], [stock, "initialStock"], [low, "lowStockAt"]] as const) {
        if (Number.isNaN(n)) errs.push(E.notNumber(vr, vLabel(k)));
      }
      if (stock !== null && stock < 0) errs.push(E.field(vr, vLabel("initialStock"), "Сөрөг байж болохгүй."));

      const owner = sku ? ctx.skuOwners.get(sku) : undefined;
      if (owner && owner !== slug) errs.push(E.skuOwned(vr, sku, owner));
      const old = existingBySku.get(sku);
      if (old && stock) warns.push(W.stockIgnored(vr, sku));
      if (old && !old.isActive) warns.push(W.archivedVariant(vr, sku));

      const priceN = price ?? 0;
      const costN = cost ?? old?.costPrice ?? 0;
      const lowN = low ?? old?.lowStockAt ?? 3;
      const action: PlannedVariant["action"] = !old
        ? "create"
        : old.size === size && old.price === priceN && old.costPrice === costN && old.lowStockAt === lowN
          ? "unchanged"
          : "update";
      planned.push({ row: v.row, sku, size, price, action, initialStock: !old && stock && stock > 0 ? stock : 0, costPrice: costN });
      if (!old) {
        variantInputs.push({ sku, size, price: priceN, costPrice: costN, lowStockAt: lowN, isActive: true });
        variantInputRows.push(v.row);
      }
      // байгаа хувилбарыг доор (existing-ийн дарааллаар) нэмнэ
    }

    if (!existing && vRows.length === 0 && first === undefined) errs.push(E.noVariants(r));

    // Байгаа хувилбарууд: дарааллаа хадгалж, Excel-ийн утгаар шинэчилнэ
    const fromExcel = new Map(planned.map((v, i) => [v.sku, { v, raw: vRows[i]! }]));
    const existingInputs: ProductInput["variants"] = [];
    const existingRows: number[] = [];
    for (const old of existing?.variants ?? []) {
      const hit = fromExcel.get(old.sku);
      if (hit) {
        const low = parseIntCell(hit.raw.values.lowStockAt);
        existingInputs.push({
          id: old.id,
          sku: old.sku,
          size: hit.v.size,
          price: hit.v.price ?? old.price,
          costPrice: hit.v.costPrice,
          lowStockAt: low !== null && !Number.isNaN(low) ? low : old.lowStockAt,
          isActive: old.isActive,
        });
        existingRows.push(hit.raw.row);
      } else {
        const { id, sku, size, price, costPrice, lowStockAt, isActive } = old;
        existingInputs.push({ id, sku, size, price, costPrice, lowStockAt, isActive });
        existingRows.push(p.row);
      }
    }
    const allVariants = [...existingInputs, ...variantInputs];
    const allVariantRows = [...existingRows, ...variantInputRows];

    // ── Нийлүүлсэн оролт
    const keep = <T,>(excel: T | undefined, old: T | undefined, fallback: T): T =>
      excel !== undefined ? excel : old !== undefined ? old : fallback;
    const text = (k: ProductColumn) => (val[k].trim() ? val[k].trim() : undefined);
    const list = (k: ProductColumn) => (val[k].trim() ? splitList(val[k]) : undefined);

    let collectionIds = existing?.collectionIds ?? [];
    if (categoryIds) collectionIds = [...collectionIds.filter((id) => collectionKind.get(id) !== "CATEGORY"), ...categoryIds];
    if (concernIds) collectionIds = [...collectionIds.filter((id) => collectionKind.get(id) !== "CONCERN"), ...concernIds];
    collectionIds = [...new Set(collectionIds)];

    const addImages = !existing || existing.images.length === 0;
    if (existing && !addImages && imageUrls.length) warns.push(W.imagesIgnored(r));
    if (existing?.kind === "BUNDLE") warns.push(W.bundleKept(r));

    const input: ProductInput = {
      ...(existing && { id: existing.id }),
      slug,
      name: keep(text("name"), existing?.name, ""),
      kind: existing?.kind ?? "SINGLE",
      tagline: keep(text("tagline"), existing?.tagline ?? undefined, null),
      recommendedFor: keep(text("recommendedFor"), existing?.recommendedFor ?? undefined, null),
      benefits: keep(list("benefits"), existing?.benefits, []),
      description: keep(text("description"), existing?.description, ""),
      skinScience: existing?.skinScience ?? null,
      howToUse: keep(list("howToUse"), existing?.howToUse, []),
      ingredients: keep(text("ingredients"), existing?.ingredients ?? undefined, null),
      environmental: Object.entries(existing?.environmental ?? {}).map(([key, value]) => ({ key, value })),
      clinicalNotes: existing?.clinicalNotes ?? [],
      seoTitle: existing?.seoTitle ?? null,
      seoDescription: existing?.seoDescription ?? null,
      badge: keep(badge, existing?.badge, null),
      isPublished: keep(isPublished, existing?.isPublished, false),
      sortOrder: existing?.sortOrder ?? 0,
      collectionIds,
      images: (existing?.images ?? []).map(({ id, url, alt }) => ({ id, url, alt })),
      variants: allVariants,
      relations: existing?.relations ?? [],
      bundleItems: existing?.bundleItems ?? [],
    };

    // Админы формтой ижил schema-гаар шалгана (давхар SKU, урт, нийтлэх нөхцөл г.м.)
    if (errs.length === 0) {
      const parsedInput = productInputSchema.safeParse(input);
      if (!parsedInput.success) {
        for (const issue of parsedInput.error.issues) errs.push(issueToMessage(issue.path, issue.message, p.row, allVariantRows));
      }
    }

    let action: ProductAction;
    if (errs.length) action = "error";
    else if (!existing) action = "create";
    else {
      const ex = existing;
      const same =
        input.name === ex.name &&
        input.tagline === ex.tagline &&
        input.recommendedFor === ex.recommendedFor &&
        sameList(input.benefits, ex.benefits) &&
        input.description === ex.description &&
        sameList(input.howToUse, ex.howToUse) &&
        input.ingredients === ex.ingredients &&
        input.badge === ex.badge &&
        input.isPublished === ex.isPublished &&
        sameSet(input.collectionIds, ex.collectionIds) &&
        planned.every((v) => v.action === "unchanged") &&
        !(addImages && imageUrls.length);
      action = same ? "unchanged" : "update";
    }

    return {
      row: p.row,
      slug,
      name: input.name || slug,
      action,
      errors: [...new Set(errs)],
      warnings: [...new Set(warns)],
      variants: planned,
      imageUrls: addImages ? imageUrls : [],
      ...((action === "create" || action === "update") && { input }),
    };
  });

  const summary: Record<ProductAction, number> = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const p of products) summary[p.action]++;
  const canImport = errors.length === 0 && summary.error === 0 && summary.create + summary.update > 0;
  return { errors: [...new Set(errors)], products, summary, canImport };
}
