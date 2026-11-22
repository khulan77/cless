import { CollectionForm } from "@/components/admin/collections/CollectionForm";
import { PageHeader } from "@/components/admin/ui";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Шинэ ангилал" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function NewCollectionPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requirePagePermission("product:write");
  const { kind } = await searchParams;
  return (
    <>
      <PageHeader title="Шинэ ангилал" />
      <CollectionForm
        initial={{
          name: "", slug: "", kind: kind === "CONCERN" ? "CONCERN" : "CATEGORY", description: "", image: null,
          navGroup: "face", sortOrder: 0, showOnHome: false,
        }}
      />
    </>
  );
}
