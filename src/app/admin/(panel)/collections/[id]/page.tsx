import { notFound } from "next/navigation";
import { CollectionForm } from "@/components/admin/collections/CollectionForm";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/server/db";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Ангилал засах" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("product:write");
  const { id } = await params;
  const c = await db.collection.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!c) notFound();
  return (
    <>
      <PageHeader title={c.name} />
      <CollectionForm
        productCount={c._count.products}
        initial={{
          id: c.id, name: c.name, slug: c.slug, kind: c.kind, description: c.description ?? "", image: c.image,
          navGroup: c.navGroup === "face" || c.navGroup === "body-hair" ? c.navGroup : null,
          sortOrder: c.sortOrder, showOnHome: c.showOnHome,
        }}
      />
    </>
  );
}
