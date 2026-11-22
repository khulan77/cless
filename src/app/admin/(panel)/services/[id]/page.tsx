import { notFound } from "next/navigation";
import { ServiceForm } from "@/components/admin/services/ServiceForm";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/server/db";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Үйлчилгээ засах" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("service:write");
  const { id } = await params;
  const service = await db.service.findUnique({
    where: { id },
    include: {
      consumables: {
        orderBy: { createdAt: "asc" },
        include: { variant: { select: { sku: true, size: true, product: { select: { name: true } } } } },
      },
    },
  });
  if (!service) notFound();

  return (
    <>
      <PageHeader title={service.name} description={service.isActive ? "Идэвхтэй" : "Архив"} />
      <ServiceForm
        variantLabels={Object.fromEntries(
          service.consumables.map((c) => [c.variantId, `${c.variant.product.name} · ${c.variant.size} (${c.variant.sku})`]),
        )}
        initial={{
          id: service.id,
          name: service.name,
          slug: service.slug,
          description: service.description,
          durationMin: service.durationMin,
          price: service.price,
          costNote: service.costNote ?? "",
          image: service.image,
          isActive: service.isActive,
          sortOrder: service.sortOrder,
          consumables: service.consumables.map((c) => ({ variantId: c.variantId, qtyPerService: c.qtyPerService })),
        }}
      />
    </>
  );
}
