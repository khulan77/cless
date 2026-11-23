import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/server/db";
import { absoluteUrl } from "@/lib/site-url";

/**
 * /sitemap.xml — нүүр, ангилал бүр, нийтлэгдсэн бараа бүр, контент хуудсууд.
 * Админ бараа/ангилал/контент хадгалахад updateTag("catalog" | "settings")-аар шинэчлэгдэнэ.
 */
async function sitemapData() {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86_400 });
  cacheTag("catalog", "settings");

  const [products, collections, settings, services] = await Promise.all([
    db.product.findMany({
      where: { isPublished: true, variants: { some: { isActive: true } } },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.collection.findMany({ select: { slug: true, updatedAt: true }, orderBy: { sortOrder: "asc" } }),
    db.siteSetting.findMany({
      where: { key: { in: ["hero", "aboutPage", "privacyPage", "contactPage", "footer"] } },
      select: { key: true, updatedAt: true },
    }),
    db.service.aggregate({ where: { isActive: true }, _max: { updatedAt: true } }),
  ]);
  return { products, collections, settings, servicesUpdatedAt: services._max.updatedAt };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products, collections, settings, servicesUpdatedAt } = await sitemapData();
  const settingAt = (key: string) => settings.find((s) => s.key === key)?.updatedAt;
  const latest = (...dates: (Date | null | undefined)[]) => {
    const ts = dates.filter((d): d is Date => !!d).map((d) => d.getTime());
    return ts.length ? new Date(Math.max(...ts)) : undefined;
  };
  const catalogAt = latest(...products.map((p) => p.updatedAt), ...collections.map((c) => c.updatedAt));

  return [
    { url: absoluteUrl("/"), lastModified: latest(catalogAt, settingAt("hero")), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/collections"), lastModified: latest(...collections.map((c) => c.updatedAt)), changeFrequency: "weekly", priority: 0.7 },
    ...collections.map((c) => ({
      url: absoluteUrl(`/collections/${c.slug}`),
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: absoluteUrl(`/products/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    { url: absoluteUrl("/services"), lastModified: servicesUpdatedAt ?? undefined, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/about"), lastModified: settingAt("aboutPage"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/contact"), lastModified: latest(settingAt("contactPage"), settingAt("footer")), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/privacy"), lastModified: settingAt("privacyPage"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
