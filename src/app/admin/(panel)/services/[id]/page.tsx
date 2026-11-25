import { notFound } from "next/navigation";
import { ServiceForm } from "@/components/admin/services/ServiceForm";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/server/db";
import { serviceCategories } from "@/server/modules/services/categories";
import { requirePageOrView } from "@/server/auth/session";
import { ReadOnlyFieldset } from "@/components/admin/readonly/ReadOnly";

export const metadata = { title: "Үйлчилгээ засах" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { readOnly } = await requirePageOrView("service:write");
  const { id } = await params;
  const [service, categories] = await Promise.all([db.service.findUnique({
    where: { id },
    include: {
      consumables: {
        orderBy: { createdAt: "asc" },
        include: { variant: { select: { sku: true, size: true, product: { select: { name: true } } } } },
      },
    },
  }), serviceCategories()]);
  if (!service) notFound();

  return (
    <>
      <PageHeader title={service.name} description={service.isActive ? "Идэвхтэй" : "Архив"} />
      <ReadOnlyFieldset readOnly={readOnly}>
      <ServiceForm
        categories={categories}
        variantLabels={Object.fromEntries(
          service.consumables.map((c) => [c.variantId, `${c.variant.product.name} · ${c.variant.size} (${c.variant.sku})`]),
        )}
        initial={{
          id: service.id,
          name: service.name,
          slug: service.slug,
          description: service.description,
          durationMin: service.durationMin,
          bufferMin: service.bufferMin,
          requiresRoom: service.requiresRoom,
          bookable: service.bookable,
          isPublic: service.isPublic,
          category: service.category ?? "",
          shortDescription: service.shortDescription ?? "",
          suitableFor: service.suitableFor ?? "",
          results: service.results ?? "",
          priceFrom: service.priceFrom,
          price: service.price,
          costNote: service.costNote ?? "",
          image: service.image,
          isActive: service.isActive,
          sortOrder: service.sortOrder,
          consumables: service.consumables.map((c) => ({ variantId: c.variantId, qtyPerService: c.qtyPerService })),
        }}
      />
      </ReadOnlyFieldset>
    </>
  );
}
