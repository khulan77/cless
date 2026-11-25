import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { Card, PageHeader, btnClass, tdClass, thClass } from "@/components/admin/ui";
import { formatMNT } from "@/lib/money";
import { db } from "@/server/db";
import { requirePageOrView } from "@/server/auth/session";
import { ReadOnlyFieldset } from "@/components/admin/readonly/ReadOnly";
import { listCollectionOptions } from "@/server/queries/admin";

export const metadata = { title: "Бүтээгдэхүүн засах" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

const dt = new Intl.DateTimeFormat("mn-MN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ulaanbaatar" });

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { readOnly } = await requirePageOrView("product:write");
  const { id } = await params;
  const [product, collections] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { sortOrder: "asc" } },
        collections: { select: { collectionId: true } },
        relations: { orderBy: [{ type: "asc" }, { position: "asc" }], include: { related: { select: { name: true } } } },
        bundleItems: {
          orderBy: { position: "asc" },
          include: { variant: { select: { sku: true, size: true, product: { select: { name: true } } } } },
        },
      },
    }),
    listCollectionOptions(),
  ]);
  if (!product) notFound();

  const history = await db.priceHistory.findMany({
    where: { variantId: { in: product.variants.map((v) => v.id) } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { variant: { select: { sku: true } }, changedBy: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title={product.name}
        eyebrow="Бүтээгдэхүүн"
        description={product.isPublished ? "Сайтад харагдаж байна" : "Нийтлээгүй — сайтад харагдахгүй"}
        actions={
          product.isPublished ? (
            <Link href={`/products/${product.slug}`} target="_blank" className={btnClass("secondary")}>
              Сайт дээр харах ↗
            </Link>
          ) : null
        }
      />
      <ReadOnlyFieldset readOnly={readOnly}>
      <ProductForm
        collections={collections}
        stockByVariant={Object.fromEntries(product.variants.map((v) => [v.id, v.stock]))}
        labels={{
          ...Object.fromEntries(product.relations.map((r) => [r.relatedId, r.related.name])),
          ...Object.fromEntries(
            product.bundleItems.map((b) => [b.variantId, `${b.variant.product.name} · ${b.variant.size} (${b.variant.sku})`]),
          ),
        }}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          kind: product.kind,
          tagline: product.tagline ?? "",
          recommendedFor: product.recommendedFor ?? "",
          benefits: product.benefits,
          description: product.description,
          skinScience: product.skinScience ?? "",
          howToUse: product.howToUse,
          ingredients: product.ingredients ?? "",
          environmental:
            product.environmental && typeof product.environmental === "object" && !Array.isArray(product.environmental)
              ? Object.entries(product.environmental as Record<string, unknown>).map(([key, value]) => ({ key, value: String(value) }))
              : [],
          clinicalNotes: product.clinicalNotes,
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
          relations: product.relations.map((r) => ({ relatedId: r.relatedId, type: r.type })),
          bundleItems: product.bundleItems.map((b) => ({ variantId: b.variantId, qty: b.qty })),
          badge: product.badge,
          isPublished: product.isPublished,
          sortOrder: product.sortOrder,
          collectionIds: product.collections.map((c) => c.collectionId),
          images: product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt })),
          variants: product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            barcode: v.barcode,
            size: v.size,
            price: v.price,
            costPrice: v.costPrice,
            lowStockAt: v.lowStockAt,
            isActive: v.isActive,
          })),
        }}
      />
      </ReadOnlyFieldset>

      <Card title="Үнийн түүх" description="Сүүлийн 10 өөрчлөлт" className="mt-5 lg:mr-[340px]">
        {history.length === 0 ? (
          <p className="text-[14px] text-ink-soft">Өөрчлөлт алга.</p>
        ) : (
          <div className="-m-5 overflow-x-auto">
            <table className="w-full min-w-[600px] text-[13px]">
              <thead>
                <tr>
                  <th className={thClass}>Огноо</th>
                  <th className={thClass}>Барааны код</th>
                  <th className={`${thClass} text-right`}>Үнэ</th>
                  <th className={`${thClass} text-right`}>Өртөг</th>
                  <th className={thClass}>Хэн</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className={tdClass}>{dt.format(h.createdAt)}</td>
                    <td className={`${tdClass} font-mono text-[13px]`}>{h.variant.sku}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(h.oldPrice)} → {formatMNT(h.newPrice)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(h.oldCost)} → {formatMNT(h.newCost)}</td>
                    <td className={tdClass}>{h.changedBy?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
