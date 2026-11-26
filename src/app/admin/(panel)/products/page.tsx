import Image from "next/image";
import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination, parsePage, str } from "@/components/admin/Pagination";
import { Package, Plus } from "lucide-react";
import { Badge, ButtonLink, EmptyState, PageHeader, SegmentedTabs, Table, inputClass, tdClass, thClass } from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";
import { formatMNT } from "@/lib/money";
import { infra } from "@/i18n/mn.infra";
import { BADGE_LABELS } from "@/lib/validation/product";
import { db } from "@/server/db";
import { requirePageOrView } from "@/server/auth/session";
import { ProductBulkProvider, ProductBulkToolbar, RowCheckbox, SelectAllCheckbox } from "@/components/admin/products/ProductBulk";

export const metadata = { title: "Бүтээгдэхүүн" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;
const PAGE_SIZE = 20;

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const { readOnly } = await requirePageOrView("product:write");
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
        tagline: true,
        benefits: true,
        kind: true,
        badge: true,
        isPublished: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
        variants: { select: { price: true, stock: true, isActive: true } },
      },
    }),
    db.collection.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, kind: true } }),
  ]);

  const tabHref = (st?: string) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(collection && { collection }), ...(st && { status: st }) }).toString();
    return p ? `/admin/products?${p}` : "/admin/products";
  };

  return (
    <>
      <PageHeader
        eyebrow="Дэлгүүр"
        title="Бүтээгдэхүүн"
        description={`Дэлгүүрт харагдах бүтээгдэхүүн, хэмжээ, үнэ · нийт ${total}`}
        actions={
          readOnly ? null : <>
            <ButtonLink href="/admin/products/import" variant="secondary">
              {infra.import.button}
            </ButtonLink>
            <ButtonLink href="/admin/products/new">
              <Plus className="size-[18px]" strokeWidth={2} /> Бүтээгдэхүүн нэмэх
            </ButtonLink>
          </>
        }
      />
      <SegmentedTabs
        className="mb-4"
        label="Төлөв"
        value={status ?? "all"}
        items={[
          { value: "all", label: "Бүгд", href: tabHref() },
          { value: "published", label: "Сайтад харагдаж буй", href: tabHref("published") },
          { value: "draft", label: "Нийтлээгүй", href: tabHref("draft") },
        ]}
      />
      <FilterBar action="/admin/products" resetHref={q || collection ? tabHref(status) : undefined}>
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Нэр эсвэл барааны кодоор хайх" aria-label="Хайх" className={`${inputClass} w-72`} />
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
      </FilterBar>

      {products.length === 0 ? (
        total === 0 && !q && !collection && !status ? (
          <EmptyState icon={Package} title="Бүтээгдэхүүн алга">
            «Бүтээгдэхүүн нэмэх»-ээр нэр, ангилал, үнэ, зургаа оруулна уу. Хадгалж «Сайтад» болгоход дэлгүүрт шууд харагдана.
          </EmptyState>
        ) : (
          <EmptyState icon={Package} title="Бүтээгдэхүүн олдсонгүй">Хайлт, шүүлтүүрээ өөрчилж үзнэ үү.</EmptyState>
        )
      ) : (
        <ProductBulkProvider key={`${page}-${q ?? ""}-${collection ?? ""}-${status ?? ""}`}>
        {!readOnly && <ProductBulkToolbar />}
        <Table>
          <thead>
            <tr>
              {!readOnly && (
                <th className={`${thClass} w-10`}>
                  <SelectAllCheckbox ids={products.map((p) => p.id)} />
                </th>
              )}
              <th className={`${thClass} w-14`}><span className="sr-only">Зураг</span></th>
              <th className={thClass}>Нэр</th>
              <th className={`${thClass} text-right`}>Хэмжээ</th>
              <th className={`${thClass} text-right`}>Үнэ</th>
              <th className={`${thClass} text-right`}>Үлдэгдэл</th>
              <th className={thClass}>Тэмдэг</th>
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
                <tr key={p.id} className="hover:bg-canvas">
                  {!readOnly && (
                    <td className={tdClass}>
                      <RowCheckbox id={p.id} name={p.name} />
                    </td>
                  )}
                  <td className={tdClass}>
                    <div className="relative size-12 overflow-hidden rounded-xl bg-canvas">
                      {img && <Image src={img.url} alt={img.alt} fill sizes="48px" unoptimized={img.url.endsWith(".svg")} className="object-contain" />}
                    </div>
                  </td>
                  <td className={tdClass}>
                    <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                    {p.kind === "BUNDLE" && <span className="ml-2"><Badge tone="champagne">Багц</Badge></span>}
                    <p className="text-[13px] text-ink-soft">{p.tagline ?? p.benefits.join(" / ")}</p>
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {active.length}
                    {p.variants.length > active.length && <span className="text-ink-faint"> (+{p.variants.length - active.length})</span>}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {prices.length === 0 ? "—" : min === max ? formatMNT(min) : `${formatMNT(min)} – ${formatMNT(max)}`}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums ${stock === 0 ? "text-danger" : ""}`}>{stock}</td>
                  <td className={tdClass}>{p.badge ? <Badge>{BADGE_LABELS[p.badge]}</Badge> : <span className="text-ink-faint">—</span>}</td>
                  <td className={tdClass}>{p.isPublished ? <Badge tone="green">Сайтад</Badge> : <Badge>Нийтлээгүй</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        </ProductBulkProvider>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/products" params={{ q, collection, status }} />
    </>
  );
}
