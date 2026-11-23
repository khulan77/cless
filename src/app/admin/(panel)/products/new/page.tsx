import { ProductForm } from "@/components/admin/products/ProductForm";
import { PageHeader } from "@/components/admin/ui";
import { requirePagePermission } from "@/server/auth/session";
import { listCollectionOptions } from "@/server/queries/admin";

export const metadata = { title: "Шинэ бүтээгдэхүүн" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function NewProductPage() {
  await requirePagePermission("product:write");
  const collections = await listCollectionOptions();
  return (
    <>
      <PageHeader eyebrow="Бүтээгдэхүүн" title="Шинэ бүтээгдэхүүн" description="Нэр, зураг, хэмжээ ба үнэ — хадгалаад «Сайтад нийтлэх» сонгоход дэлгүүрт гарна." />
      <ProductForm
        collections={collections}
        initial={{
          name: "",
          slug: "",
          kind: "SINGLE",
          tagline: "",
          recommendedFor: "",
          benefits: [],
          description: "",
          skinScience: "",
          howToUse: [],
          ingredients: "",
          environmental: [],
          clinicalNotes: [],
          seoTitle: "",
          seoDescription: "",
          relations: [],
          bundleItems: [],
          badge: null,
          isPublished: false,
          sortOrder: 0,
          collectionIds: [],
          images: [],
          variants: [{ sku: "", size: "", price: 0, costPrice: 0, lowStockAt: 3, isActive: true }],
        }}
      />
    </>
  );
}
