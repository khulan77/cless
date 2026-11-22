import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ConcernGrid } from "@/components/home/ConcernGrid";
import { getCollections } from "@/server/queries/catalog";
import { getSetting } from "@/server/queries/settings";
import { t } from "@/i18n";

export const metadata = { title: t.pages.collections.title };

export default async function CollectionsIndexPage() {
  const [categoryGrid, concernGrid, categories, concerns] = await Promise.all([
    getSetting("categoryGrid"),
    getSetting("concernGrid"),
    getCollections("CATEGORY"),
    getCollections("CONCERN"),
  ]);
  return (
    <div className="pb-16 md:pb-24">
      <h1 className="sr-only">{t.pages.collections.title}</h1>
      <CategoryGrid setting={categoryGrid ?? { title: t.pages.collections.categoryFallback }} categories={categories} />
      <ConcernGrid setting={concernGrid ?? { title: t.pages.collections.concernFallback }} concerns={concerns} />
    </div>
  );
}
