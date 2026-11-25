import { notFound } from "next/navigation";
import { CollectionForm } from "@/components/admin/collections/CollectionForm";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/server/db";
import { requirePageOrView } from "@/server/auth/session";
import { ReadOnlyFieldset } from "@/components/admin/readonly/ReadOnly";
import { listCollectionOptions } from "@/server/queries/admin";

export const metadata = { title: "Ангилал засах" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { readOnly } = await requirePageOrView("product:write");
  const { id } = await params;
  const [c, options] = await Promise.all([
    db.collection.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, children: true } },
        products: { orderBy: { position: "asc" }, select: { product: { select: { id: true, name: true } } } },
        tiles: { orderBy: { position: "asc" } },
      },
    }),
    listCollectionOptions(),
  ]);
  if (!c) notFound();

  // Өөрийг нь болон удмыг нь эцэг болгож сонгуулахгүй
  const descendants = new Set<string>([c.id]);
  for (const o of options) if (o.parentId && descendants.has(o.parentId)) descendants.add(o.id);

  return (
    <>
      <PageHeader eyebrow="Ангилал" title={c.name} description="Нэр, баннер, бүтээгдэхүүний дараалал" />
      <ReadOnlyFieldset readOnly={readOnly}>
      <CollectionForm
        blockers={c._count.products + c._count.children}
        parents={options.filter((o) => !descendants.has(o.id))}
        products={c.products.map((p) => p.product)}
        initial={{
          id: c.id,
          name: c.name,
          slug: c.slug,
          kind: c.kind,
          parentId: c.parentId,
          heading: c.heading ?? "",
          intro: c.intro ?? "",
          seoText: c.seoText ?? "",
          bannerImage: c.bannerImage,
          tileImage: c.tileImage,
          showInMenu: c.showInMenu,
          sortOrder: c.sortOrder,
          showOnHome: c.showOnHome,
          productOrder: c.products.map((p) => p.product.id),
          tiles: c.tiles.map((t) => ({
            id: t.id,
            position: t.position,
            image: t.image,
            eyebrow: t.eyebrow ?? "",
            title: t.title,
            text: t.text ?? "",
            ctaLabel: t.ctaLabel ?? "",
            ctaHref: t.ctaHref ?? "",
          })),
        }}
      />
      </ReadOnlyFieldset>
    </>
  );
}
