import { ServiceForm } from "@/components/admin/services/ServiceForm";
import { PageHeader } from "@/components/admin/ui";
import { serviceCategories } from "@/server/modules/services/categories";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Шинэ үйлчилгээ" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function NewServicePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requirePagePermission("service:write");
  // "+ Үйлчилгээ" next to a category heading prefills that category
  const category = ((await searchParams).category ?? "").slice(0, 80);
  return (
    <>
      <PageHeader eyebrow="Үйлчилгээ" title="Шинэ үйлчилгээ" description="Нэр, хугацаа, үнэ — сайт ба календарьт харагдана." />
      <ServiceForm
        categories={await serviceCategories()}
        variantLabels={{}}
        initial={{ name: "", slug: "", description: "", durationMin: 60, bufferMin: 0, requiresRoom: false, bookable: true, isPublic: true, category, shortDescription: "", suitableFor: "", results: "", priceFrom: false, price: 0, costNote: "", image: null, isActive: true, sortOrder: 0, consumables: [] }}
      />
    </>
  );
}
