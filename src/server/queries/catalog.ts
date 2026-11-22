import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/server/db";
import type { BadgeType, CollectionKind, Prisma, ProductKind, RelationType } from "@/generated/prisma/client";
import type { NavCollectionSource, NavItem } from "@/lib/site-settings";

// Cache Components горимд `revalidate`-ийн оронд cacheLife. stale >= 5 мин байх ёстой
// (эс бөгөөс App Shell-ээс хасагдана). Админ хадгалахад updateTag("catalog") шууд шинэчилнэ.
const HOME_CACHE = { stale: 300, revalidate: 60, expire: 3600 } as const;
const PAGE_CACHE = { stale: 300, revalidate: 300, expire: 86400 } as const;

// ─────────────── DTO ───────────────

/** Client руу үлдэгдлийн тоо илгээхгүй — зөвхөн боломжтой эсэх */
export type CardVariant = {
  id: string;
  size: string;
  price: number;
  available: boolean;
  lowStock: boolean;
};

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  kind: ProductKind;
  badge: BadgeType | null;
  benefits: string[];
  images: { src: string; alt: string }[];
  variants: CardVariant[];
  /** BUNDLE: "LAIT S.R. 50 мл / LOTION P50 50 мл / …" */
  bundleSummary: string | null;
};

export type CollectionTile = { slug: string; name: string; heading: string | null; image: string | null; href: string };

export type ResolvedNavItem = {
  label: string;
  href: string;
  groups: { title: string; links: { label: string; href: string }[] }[];
};

export type Crumb = { name: string; href: string };

// ─────────────── helpers ───────────────

export const collectionHref = (slug: string) => `/collections/${slug}`;
export const productHref = (slug: string) => `/products/${slug}`;

const variantStockSelect = { id: true, size: true, price: true, stock: true, reserved: true, lowStockAt: true } as const;

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  kind: true,
  badge: true,
  benefits: true,
  images: { orderBy: { sortOrder: "asc" }, take: 4, select: { url: true, alt: true } },
  variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: variantStockSelect },
  bundleItems: {
    orderBy: { position: "asc" },
    select: {
      qty: true,
      variant: {
        select: { size: true, stock: true, reserved: true, isActive: true, product: { select: { name: true } } },
      },
    },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

function variantAvailability(v: { stock: number; reserved: number; lowStockAt: number }) {
  const free = v.stock - v.reserved;
  return { available: free > 0, lowStock: free > 0 && free <= v.lowStockAt };
}

/** Багц: бүрэлдэхүүн бүр хангалттай бол л боломжтой */
function bundleAvailable(items: CardRow["bundleItems"]) {
  return items.length > 0 && items.every((i) => i.variant.isActive && i.variant.stock - i.variant.reserved >= i.qty);
}

function toCard(p: CardRow): ProductCardData {
  const isBundle = p.kind === "BUNDLE";
  const bundleOk = isBundle ? bundleAvailable(p.bundleItems) : true;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    kind: p.kind,
    badge: p.badge,
    benefits: p.benefits,
    images: p.images.map((i) => ({ src: i.url, alt: i.alt })),
    variants: p.variants.map((v) => {
      const a = variantAvailability(v);
      return {
        id: v.id,
        size: v.size,
        price: v.price,
        // Багцын өөрийн үлдэгдлийг биш, бүрэлдэхүүнийг харна
        available: isBundle ? bundleOk : a.available,
        lowStock: isBundle ? false : a.lowStock,
      };
    }),
    bundleSummary: isBundle ? p.bundleItems.map((i) => `${i.variant.product.name} ${i.variant.size}`).join(" / ") : null,
  };
}

// ─────────────── Нүүр хуудас ───────────────

/** Badge-тай (ICONIC/NEW) нийтлэгдсэн бүтээгдэхүүнүүд — ICONIC эхэнд. */
export async function getBadgedProducts(badges: BadgeType[] = ["ICONIC", "NEW"], limit = 12): Promise<ProductCardData[]> {
  "use cache";
  cacheLife(HOME_CACHE);
  cacheTag("catalog");

  const rows = await db.product.findMany({
    where: { isPublished: true, badge: { in: badges }, variants: { some: { isActive: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: cardSelect,
  });
  const order = (b: BadgeType | null) => (b ? badges.indexOf(b) : badges.length);
  return rows.map(toCard).sort((a, b) => order(a.badge) - order(b.badge));
}

export async function getProductCard(slug: string): Promise<ProductCardData | null> {
  "use cache";
  cacheLife(HOME_CACHE);
  cacheTag("catalog", `product:${slug}`);

  const row = await db.product.findFirst({ where: { slug, isPublished: true }, select: cardSelect });
  return row ? toCard(row) : null;
}

export async function getCollections(
  kind: CollectionKind,
  opts: {
    onlyHome?: boolean;
    parentSlug?: string;
    slugs?: string[];
    rootsOnly?: boolean;
    menuOnly?: boolean;
    limit?: number;
  } = {},
): Promise<CollectionTile[]> {
  "use cache";
  cacheLife(HOME_CACHE);
  cacheTag("catalog", "collections");

  const rows = await db.collection.findMany({
    where: {
      kind,
      ...(opts.onlyHome && { showOnHome: true }),
      ...(opts.menuOnly && { showInMenu: true }),
      ...(opts.parentSlug && { parent: { slug: opts.parentSlug } }),
      ...(opts.slugs && { slug: { in: opts.slugs } }),
      ...(opts.rootsOnly && { parentId: null }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: opts.limit,
    select: { slug: true, name: true, heading: true, tileImage: true },
  });
  return rows.map((c) => ({ slug: c.slug, name: c.name, heading: c.heading, image: c.tileImage, href: collectionHref(c.slug) }));
}

function collectionsFor(source: Pick<NavCollectionSource, "kind" | "parentSlug" | "slugs">) {
  return getCollections(source.kind, {
    menuOnly: true,
    parentSlug: source.parentSlug,
    slugs: source.slugs,
    // CONCERN хавтгай; CATEGORY-д эцэг заагаагүй бол дээд түвшин
    rootsOnly: !source.parentSlug && !source.slugs && source.kind === "CATEGORY",
  });
}

/** SiteSetting.navigation-ийн бүлгүүдийг DB-ийн Collection-оор бөглөнө. */
export async function resolveNavigation(items: NavItem[]): Promise<ResolvedNavItem[]> {
  return Promise.all(
    items.map(async (item) => ({
      label: item.label,
      href: item.href,
      groups: await Promise.all(
        (item.groups ?? []).map(async (g) => ({
          title: g.title,
          links: (await collectionsFor(g)).map((c) => ({ label: c.name, href: c.href })),
        })),
      ),
    })),
  );
}

/** Footer-ийн баганыг Collection-оор баяжуулна */
export async function resolveFooterColumns(
  columns: {
    title: string;
    links: { label: string; href: string }[];
    collections?: { kind: CollectionKind; parentSlug?: string; slugs?: string[] };
  }[],
) {
  return Promise.all(
    columns.map(async (col) => ({
      title: col.title,
      links: col.collections
        ? [...(await collectionsFor(col.collections)).map((c) => ({ label: c.name, href: c.href })), ...col.links]
        : col.links,
    })),
  );
}

// ─────────────── Ангиллын хуудас ───────────────

export async function getAllCollectionSlugs(): Promise<string[]> {
  "use cache";
  cacheLife(PAGE_CACHE);
  cacheTag("catalog", "collections");
  return (await db.collection.findMany({ select: { slug: true } })).map((c) => c.slug);
}

export type CollectionLink = { slug: string; name: string; href: string };

export type CollectionGridTile = {
  id: string;
  position: number;
  image: string;
  eyebrow: string | null;
  title: string;
  text: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

export type CollectionPageData = {
  slug: string;
  name: string;
  heading: string;
  kind: CollectionKind;
  intro: string | null;
  seoText: string | null;
  bannerImage: string | null;
  breadcrumb: Crumb[];
  parent: CollectionLink | null;
  siblings: CollectionLink[];
  children: CollectionLink[];
  tiles: CollectionGridTile[];
  /** Бүх бүтээгдэхүүн, дарааллаар, давхардалгүй (хуудаслалтыг page хийнэ) */
  products: ProductCardData[];
};

const linkOf = (c: { slug: string; name: string }): CollectionLink => ({
  slug: c.slug,
  name: c.name,
  href: collectionHref(c.slug),
});

export async function getCollectionPage(slug: string): Promise<CollectionPageData | null> {
  "use cache";
  cacheLife(PAGE_CACHE);
  cacheTag("catalog", "collections", `collection:${slug}`);

  // 1) Ангиллын мод нэг query-ээр
  const c = await db.collection.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      heading: true,
      kind: true,
      intro: true,
      seoText: true,
      bannerImage: true,
      parent: {
        select: {
          slug: true,
          name: true,
          parent: { select: { slug: true, name: true } },
          children: { where: { showInMenu: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } },
        },
      },
      children: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          showInMenu: true,
          children: { orderBy: { sortOrder: "asc" }, select: { id: true } },
        },
      },
      tiles: { orderBy: { position: "asc" } },
    },
  });
  if (!c) return null;

  const siblings = c.parent
    ? c.parent.children
    : await db.collection.findMany({
        where: { kind: c.kind, parentId: null, showInMenu: true },
        orderBy: { sortOrder: "asc" },
        select: { slug: true, name: true },
      });

  // 2) Өөрийн + дэд ангиллын (2 түвшин) бүтээгдэхүүн — нэг query
  const order = [c.id, ...c.children.flatMap((ch) => [ch.id, ...ch.children.map((g) => g.id)])];
  const rows = await db.productCollection.findMany({
    where: { collectionId: { in: order }, product: { isPublished: true } },
    select: { collectionId: true, position: true, product: { select: { ...cardSelect, sortOrder: true } } },
  });
  rows.sort(
    (a, b) =>
      order.indexOf(a.collectionId) - order.indexOf(b.collectionId) ||
      a.position - b.position ||
      a.product.sortOrder - b.product.sortOrder,
  );
  const seen = new Set<string>();
  const products: ProductCardData[] = [];
  for (const r of rows) {
    if (seen.has(r.product.id)) continue;
    seen.add(r.product.id);
    const card = toCard(r.product);
    if (card.variants.length) products.push(card);
  }

  const breadcrumb: Crumb[] = [];
  if (c.parent?.parent) breadcrumb.push({ name: c.parent.parent.name, href: collectionHref(c.parent.parent.slug) });
  if (c.parent) breadcrumb.push({ name: c.parent.name, href: collectionHref(c.parent.slug) });

  return {
    slug: c.slug,
    name: c.name,
    heading: c.heading ?? c.name,
    kind: c.kind,
    intro: c.intro,
    seoText: c.seoText,
    bannerImage: c.bannerImage,
    breadcrumb,
    parent: c.parent ? linkOf(c.parent) : null,
    siblings: siblings.map(linkOf),
    children: c.children.filter((ch) => ch.showInMenu).map(linkOf),
    tiles: c.tiles.map((t) => ({
      id: t.id,
      position: t.position,
      image: t.image,
      eyebrow: t.eyebrow,
      title: t.title,
      text: t.text,
      ctaLabel: t.ctaLabel,
      ctaHref: t.ctaHref,
    })),
    products,
  };
}

// ─────────────── Бүтээгдэхүүний хуудас ───────────────

export async function getAllProductSlugs(): Promise<string[]> {
  "use cache";
  cacheLife(PAGE_CACHE);
  cacheTag("catalog");
  return (await db.product.findMany({ where: { isPublished: true }, select: { slug: true } })).map((p) => p.slug);
}

export type BundleComponent = {
  slug: string;
  name: string;
  size: string;
  qty: number;
  image: { src: string; alt: string } | null;
  available: boolean;
};

export type ProductPageData = ProductCardData & {
  recommendedFor: string | null;
  description: string;
  skinScience: string | null;
  howToUse: string[];
  ingredients: string | null;
  environmental: { key: string; value: string }[];
  clinicalNotes: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  /** Gallery: бүх зураг */
  gallery: { src: string; alt: string }[];
  /** JSON-LD-д (variantId → SKU). Үлдэгдэл биш тул client-д аюулгүй */
  skus: Record<string, string>;
  breadcrumb: Crumb[];
  bundleItems: BundleComponent[];
  protocol: ProductCardData[];
  similar: ProductCardData[];
  perfectMatch: ProductCardData | null;
};

type CollectionParent = { id: string; slug: string; name: string; parent?: CollectionParent | null };
type CollectionNode = CollectionParent & { kind: CollectionKind };

/** Эцэг ангиллын шатлал (Prisma-д рекурсив select байхгүй тул 3 түвшин — мод ≤4 гүн) */
const parentSelect = {
  select: {
    id: true,
    slug: true,
    name: true,
    parent: { select: { id: true, slug: true, name: true, parent: { select: { id: true, slug: true, name: true } } } },
  },
} as const;

/** Дээрээс доош: [Нүүрний арчилгаа, Серум, Хөгшрөлтийн эсрэг] */
function ancestry(c: CollectionParent): CollectionParent[] {
  const chain: CollectionParent[] = [];
  for (let n: CollectionParent | null | undefined = c; n; n = n.parent) chain.unshift(n);
  return chain;
}

/** Үндсэн ангилал: хамгийн гүн CATEGORY (Серум › Хөгшрөлтийн эсрэг гэх мэт) */
function primaryCategory(collections: { collection: CollectionNode }[]): CollectionParent[] {
  const chains = collections.filter((c) => c.collection.kind === "CATEGORY").map((c) => ancestry(c.collection));
  return chains.sort((a, b) => b.length - a.length)[0] ?? [];
}

export async function getProductPage(slug: string): Promise<ProductPageData | null> {
  "use cache";
  cacheLife(PAGE_CACHE);
  cacheTag("catalog", `product:${slug}`);

  const p = await db.product.findFirst({
    where: { slug, isPublished: true },
    select: {
      ...cardSelect,
      images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { ...variantStockSelect, sku: true } },
      recommendedFor: true,
      description: true,
      skinScience: true,
      howToUse: true,
      ingredients: true,
      environmental: true,
      clinicalNotes: true,
      seoTitle: true,
      seoDescription: true,
      bundleItems: {
        orderBy: { position: "asc" },
        select: {
          qty: true,
          variant: {
            select: {
              size: true,
              stock: true,
              reserved: true,
              isActive: true,
              product: {
                select: {
                  slug: true,
                  name: true,
                  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
                },
              },
            },
          },
        },
      },
      collections: {
        orderBy: { position: "asc" },
        select: {
          collection: {
            select: {
              slug: true,
              name: true,
              id: true,
              kind: true,
              parent: parentSelect,
            },
          },
        },
      },
      relations: {
        where: { related: { isPublished: true } },
        orderBy: [{ type: "asc" }, { position: "asc" }],
        select: { type: true, related: { select: cardSelect } },
      },
    },
  });
  if (!p) return null;

  const card = toCard(p);
  const byType = (type: RelationType) => p.relations.filter((r) => r.type === type).map((r) => toCard(r.related));
  const category = primaryCategory(p.collections);
  const protocol = byType("PROTOCOL");
  const similar = byType("SIMILAR");
  if (similar.length === 0) similar.push(...(await categoryFallback(p.id, category, protocol)));
  const env =
    p.environmental && typeof p.environmental === "object" && !Array.isArray(p.environmental)
      ? Object.entries(p.environmental as Record<string, unknown>).map(([key, value]) => ({ key, value: String(value) }))
      : [];

  return {
    ...card,
    recommendedFor: p.recommendedFor,
    description: p.description,
    skinScience: p.skinScience,
    howToUse: p.howToUse,
    ingredients: p.ingredients,
    environmental: env,
    clinicalNotes: p.clinicalNotes,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    gallery: p.images.map((i) => ({ src: i.url, alt: i.alt })),
    skus: Object.fromEntries(p.variants.map((v) => [v.id, v.sku])),
    breadcrumb: category.map((c) => ({ name: c.name, href: collectionHref(c.slug) })),
    bundleItems: p.bundleItems.map((b) => {
      const img = b.variant.product.images[0];
      return {
        slug: b.variant.product.slug,
        name: b.variant.product.name,
        size: b.variant.size,
        qty: b.qty,
        image: img ? { src: img.url, alt: img.alt } : null,
        available: b.variant.isActive && b.variant.stock - b.variant.reserved >= b.qty,
      };
    }),
    protocol,
    similar,
    perfectMatch: byType("BUNDLE_SUGGESTION")[0] ?? null,
  };
}

/**
 * SIMILAR холбоос байхгүй үед: үндсэн ангиллын (хамгийн гүнээс эцэг рүү) бусад бараа.
 * Өөрийгөө, PROTOCOL-д байгааг, багцыг хасна.
 */
async function categoryFallback(selfId: string, category: CollectionParent[], protocol: ProductCardData[]) {
  const exclude = [selfId, ...protocol.map((x) => x.id)];
  const out: ProductCardData[] = [];
  for (const level of [...category].reverse()) {
    if (out.length >= 8) break;
    const rows = await db.product.findMany({
      where: {
        id: { notIn: [...exclude, ...out.map((x) => x.id)] },
        isPublished: true,
        kind: { not: "BUNDLE" },
        variants: { some: { isActive: true } },
        collections: { some: { collection: { OR: [{ id: level.id }, { parentId: level.id }, { parent: { parentId: level.id } }] } } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 8 - out.length,
      select: cardSelect,
    });
    out.push(...rows.map(toCard));
  }
  return out;
}

// ─────────────── Үйлчилгээ ───────────────

export type ServiceListItem = {
  slug: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
  image: string | null;
};

export async function getActiveServices(): Promise<ServiceListItem[]> {
  "use cache";
  cacheLife(HOME_CACHE);
  cacheTag("catalog", "services");
  return db.service.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { slug: true, name: true, description: true, durationMin: true, price: true, image: true },
  });
}
