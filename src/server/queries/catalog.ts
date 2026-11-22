import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/server/db";
import type { BadgeType, CollectionKind, Prisma } from "@/generated/prisma/client";
import type { NavItem } from "@/lib/site-settings";

// Нүүр хуудасны өгөгдлийг server 60 секунд тутам шинэчилнэ (cacheComponents горимд
// `export const revalidate = 60`-ийн оронд). Админ өөрчлөлт хийхэд
// revalidateTag("catalog") дуудаж шууд шинэчилнэ.
// stale >= 5 мин байх ёстой, эс бөгөөс контент App Shell-ээс хасагдана (cacheLife docs).
const HOME_CACHE = { stale: 300, revalidate: 60, expire: 3600 } as const;

// ─────────────── DTO ───────────────

export type ProductCardVariant = {
  id: string;
  size: string;
  price: number;
  inStock: boolean;
};

export type ProductCardData = {
  slug: string;
  name: string;
  subtitle: string;
  badge: BadgeType | null;
  image: { src: string; alt: string } | null;
  variants: ProductCardVariant[];
};

export type CollectionTile = {
  slug: string;
  name: string;
  image: string | null;
  href: string;
};

export type ResolvedNavItem = {
  label: string;
  href: string;
  groups: { title: string; links: { label: string; href: string }[] }[];
};

// ─────────────── helpers ───────────────

const productCardSelect = {
  slug: true,
  name: true,
  subtitle: true,
  badge: true,
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
  variants: {
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, size: true, price: true, stock: true, reserved: true },
  },
} satisfies Prisma.ProductSelect;

type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

function toCard(p: ProductCardRow): ProductCardData {
  const img = p.images[0];
  return {
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    badge: p.badge,
    image: img ? { src: img.url, alt: img.alt } : null,
    variants: p.variants.map((v) => ({
      id: v.id,
      size: v.size,
      price: v.price,
      inStock: v.stock - v.reserved > 0,
    })),
  };
}

export function collectionHref(slug: string) {
  return `/collections/${slug}`;
}

// ─────────────── queries ───────────────

/** Badge-тай (ICONIC/NEW) нийтлэгдсэн бүтээгдэхүүнүүд — ICONIC эхэнд. */
export async function getBadgedProducts(
  badges: BadgeType[] = ["ICONIC", "NEW"],
  limit = 12,
): Promise<ProductCardData[]> {
  "use cache";
  cacheLife(HOME_CACHE);
  cacheTag("catalog");

  const rows = await db.product.findMany({
    where: { isPublished: true, badge: { in: badges }, variants: { some: { isActive: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: productCardSelect,
  });
  const order = (b: BadgeType | null) => (b ? badges.indexOf(b) : badges.length);
  return rows.map(toCard).sort((a, b) => order(a.badge) - order(b.badge));
}

export async function getProductCard(slug: string): Promise<ProductCardData | null> {
  "use cache";
  cacheLife(HOME_CACHE);
  cacheTag("catalog", `product:${slug}`);

  const row = await db.product.findFirst({
    where: { slug, isPublished: true },
    select: productCardSelect,
  });
  return row ? toCard(row) : null;
}

export async function getCollections(
  kind: CollectionKind,
  opts: { onlyHome?: boolean; navGroup?: string; limit?: number } = {},
): Promise<CollectionTile[]> {
  "use cache";
  cacheLife(HOME_CACHE);
  cacheTag("catalog", "collections");

  const rows = await db.collection.findMany({
    where: {
      kind,
      ...(opts.onlyHome ? { showOnHome: true } : {}),
      ...(opts.navGroup ? { navGroup: opts.navGroup } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: opts.limit,
    select: { slug: true, name: true, image: true },
  });
  return rows.map((c) => ({ ...c, href: collectionHref(c.slug) }));
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
          links: (await getCollections(g.kind, { navGroup: g.navGroup })).map((c) => ({
            label: c.name,
            href: c.href,
          })),
        })),
      ),
    })),
  );
}
