import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ConcernGrid } from "@/components/home/ConcernGrid";
import { getCollections } from "@/server/queries/catalog";
import { getSetting } from "@/server/queries/settings";

export const metadata = { title: "Бүх ангилал" };

export default async function CollectionsIndexPage() {
  const [categoryGrid, concernGrid, categories, concerns] = await Promise.all([
    getSetting("categoryGrid"),
    getSetting("concernGrid"),
    getCollections("CATEGORY"),
    getCollections("CONCERN"),
  ]);
  return (
    <div className="pb-16 md:pb-24">
      <h1 className="sr-only">Бүх ангилал</h1>
      <CategoryGrid setting={categoryGrid ?? { title: "Ангиллаар сонгох" }} categories={categories} />
      <ConcernGrid setting={concernGrid ?? { title: "Арьсны асуудлаар сонгох" }} concerns={concerns} />
    </div>
  );
}
