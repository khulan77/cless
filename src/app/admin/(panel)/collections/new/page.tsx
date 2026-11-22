import { CollectionForm } from "@/components/admin/collections/CollectionForm";
import { PageHeader } from "@/components/admin/ui";
import { requirePagePermission } from "@/server/auth/session";
import { listCollectionOptions } from "@/server/queries/admin";

export const metadata = { title: "Шинэ ангилал" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function NewCollectionPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requirePagePermission("product:write");
  const [{ kind }, parents] = await Promise.all([searchParams, listCollectionOptions()]);
  return (
    <>
      <PageHeader title="Шинэ ангилал" />
      <CollectionForm
        parents={parents}
        products={[]}
        initial={{
          name: "", slug: "", kind: kind === "CONCERN" ? "CONCERN" : "CATEGORY", parentId: null, heading: "", intro: "",
          seoText: "", bannerImage: null, tileImage: null, showInMenu: true, sortOrder: 0, showOnHome: false,
          productOrder: [], tiles: [],
        }}
      />
    </>
  );
}
