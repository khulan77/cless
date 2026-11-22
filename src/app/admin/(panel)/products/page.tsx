import Image from "next/image";
import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination, parsePage, str } from "@/components/admin/Pagination";
import { Badge, EmptyState, PageHeader, Table, btnClass, inputClass, tdClass, thClass } from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";
import { formatMNT } from "@/lib/money";
import { BADGE_LABELS } from "@/lib/validation/product";
import { db } from "@/server/db";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Бүтээгдэхүүн" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;
const PAGE_SIZE = 20;

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  await requirePagePermission("product:write");
  const sp = await searchParams;
  const q = str(sp.q);
  const collection = str(sp.collection);
  const status = str(sp.status);
  const page = parsePage(sp.page);

  const where: Prisma.ProductWhereInput = {
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
      ],
    }),
    ...(collection && { collections: { some: { collectionId: collection } } }),
    ...(status === "published" && { isPublished: true }),
    ...(status === "draft" && { isPublished: false }),
  };

  const [total, products, collections] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        subtitle: true,
        badge: true,
        isPublished: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
        variants: { select: { price: true, stock: true, isActive: true } },
      },
    }),
    db.collection.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, kind: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Бүтээгдэхүүн"
        description="Дэлгүүрт харагдах бүтээгдэхүүн, хувилбар, үнэ"
        actions={
          <Link href="/admin/products/new" className={btnClass("primary")}>
            + Шинэ бүтээгдэхүүн
          </Link>
        }
      />
      <FilterBar action="/admin/products" resetHref={q || collection || status ? "/admin/products" : undefined}>
        <input name="q" defaultValue={q} placeholder="Нэр, slug, SKU-ээр хайх" aria-label="Хайх" className={`${inputClass} w-64`} />
        <select name="collection" defaultValue={collection ?? ""} aria-label="Ангилал" className={`${inputClass} w-52`}>
          <option value="">Бүх ангилал</option>
          <optgroup label="Ангилал">
            {collections.filter((c) => c.kind === "CATEGORY").map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
          <optgroup label="Арьсны асуудал">
            {collections.filter((c) => c.kind === "CONCERN").map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
        </select>
        <select name="status" defaultValue={status ?? ""} aria-label="Төлөв" className={`${inputClass} w-40`}>
          <option value="">Бүх төлөв</option>
          <option value="published">Нийтлэгдсэн</option>
          <option value="draft">Ноорог / архив</option>
        </select>
      </FilterBar>

      {products.length === 0 ? (
        <EmptyState title="Бүтээгдэхүүн олдсонгүй">Шүүлтүүрээ өөрчилж үзнэ үү.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={`${thClass} w-14`}><span className="sr-only">Зураг</span></th>
              <th className={thClass}>Нэр</th>
              <th className={`${thClass} text-right`}>Хувилбар</th>
              <th className={`${thClass} text-right`}>Үнэ</th>
              <th className={`${thClass} text-right`}>Үлдэгдэл</th>
              <th className={thClass}>Badge</th>
              <th className={thClass}>Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const active = p.variants.filter((v) => v.isActive);
              const prices = active.map((v) => v.price);
              const min = prices.length ? Math.min(...prices) : 0;
              const max = prices.length ? Math.max(...prices) : 0;
              const stock = active.reduce((s, v) => s + v.stock, 0);
              const img = p.images[0];
              return (
                <tr key={p.id} className="hover:bg-navy/[0.02]">
                  <td className={tdClass}>
                    <div className="relative size-10 overflow-hidden rounded bg-card">
                      {img && <Image src={img.url} alt={img.alt} fill sizes="40px" unoptimized={img.url.endsWith(".svg")} className="object-contain" />}
                    </div>
                  </td>
                  <td className={tdClass}>
                    <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                    <p className="text-[12px] text-navy/50">{p.subtitle}</p>
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {active.length}
                    {p.variants.length > active.length && <span className="text-navy/40"> (+{p.variants.length - active.length})</span>}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {prices.length === 0 ? "—" : min === max ? formatMNT(min) : `${formatMNT(min)} – ${formatMNT(max)}`}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums ${stock === 0 ? "text-red-700" : ""}`}>{stock}</td>
                  <td className={tdClass}>{p.badge ? <Badge>{BADGE_LABELS[p.badge]}</Badge> : <span className="text-navy/30">—</span>}</td>
                  <td className={tdClass}>{p.isPublished ? <Badge tone="green">Нийтлэгдсэн</Badge> : <Badge>Ноорог</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/products" params={{ q, collection, status }} />
    </>
  );
}
