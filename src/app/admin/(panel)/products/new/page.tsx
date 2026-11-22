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
      <PageHeader title="Шинэ бүтээгдэхүүн" />
      <ProductForm
        collections={collections}
        initial={{
          name: "",
          slug: "",
          subtitle: "",
          description: "",
          howToUse: "",
          ingredients: "",
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
