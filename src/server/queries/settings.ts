import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/server/db";
import type { SiteSettingKey, SiteSettings } from "@/lib/site-settings";

/** Нэг SiteSetting уншина. Байхгүй бол null — тухайн section нуугдана. */
export async function getSetting<K extends SiteSettingKey>(key: K): Promise<SiteSettings[K] | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
  cacheTag("settings", `setting:${key}`);

  const row = await db.siteSetting.findUnique({ where: { key } });
  return (row?.value as SiteSettings[K] | undefined) ?? null;
}
