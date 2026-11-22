import { ServiceForm } from "@/components/admin/services/ServiceForm";
import { PageHeader } from "@/components/admin/ui";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Шинэ үйлчилгээ" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function NewServicePage() {
  await requirePagePermission("service:write");
  return (
    <>
      <PageHeader title="Шинэ үйлчилгээ" />
      <ServiceForm
        variantLabels={{}}
        initial={{ name: "", slug: "", description: "", durationMin: 60, bufferMin: 0, requiresRoom: false, bookable: true, price: 0, costNote: "", image: null, isActive: true, sortOrder: 0, consumables: [] }}
      />
    </>
  );
}
