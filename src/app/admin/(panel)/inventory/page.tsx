import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { StockActions } from "@/components/admin/inventory/StockActions";
import { Pagination, parsePage, str } from "@/components/admin/Pagination";
import { Badge, Checkbox, EmptyState, PageHeader, Table, inputClass, tdClass, thClass } from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";
import { formatMNT } from "@/lib/money";
import { db } from "@/server/db";
import { inventoryAccess, inventoryVariantSelect, redactCost } from "@/server/inventory/visibility";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Үлдэгдэл" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;
const PAGE_SIZE = 30;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission("stock:read");
  // Өртгийг cost:read эрхгүй бол DB-ээс уншихгүй (MANAGER)
  const { canWrite, canSeeCost: canCost } = inventoryAccess(user.role);

  const sp = await searchParams;
  const q = str(sp.q);
  const low = str(sp.low) === "1";
  const inactive = str(sp.inactive) === "1";
  const page = parsePage(sp.page);

  const where: Prisma.VariantWhereInput = {
    ...(!inactive && { isActive: true }),
    ...(low && { stock: { lte: db.variant.fields.lowStockAt } }),
    ...(q && {
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { product: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };

  const [total, rawVariants] = await Promise.all([
    db.variant.count({ where }),
    db.variant.findMany({
      where,
      orderBy: [{ product: { sortOrder: "asc" } }, { product: { name: "asc" } }, { sortOrder: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: inventoryVariantSelect(user.role),
    }),
  ]);
  const variants = rawVariants.map((v) => redactCost(v, user.role));

  return (
    <>
      <PageHeader
        title="Үлдэгдэл"
        description={canWrite ? "Орлого авах, тооллогын засвар хийх" : "Зөвхөн харах эрхтэй (засварыг админ хийнэ)"}
      />
      <FilterBar action="/admin/inventory" resetHref={q || low || inactive ? "/admin/inventory" : undefined}>
        <input name="q" defaultValue={q} placeholder="Нэр эсвэл SKU" aria-label="Хайх" className={`${inputClass} w-64`} />
        <Checkbox name="low" value="1" defaultChecked={low} label="Зөвхөн бага үлдэгдэл" className="h-9" />
        <Checkbox name="inactive" value="1" defaultChecked={inactive} label="Идэвхгүйг харуулах" className="h-9" />
      </FilterBar>

      {variants.length === 0 ? (
        <EmptyState title="Хувилбар олдсонгүй" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>Бүтээгдэхүүн</th>
              <th className={thClass}>SKU</th>
              <th className={`${thClass} text-right`}>Үлдэгдэл</th>
              <th className={`${thClass} text-right`}>Нөөцөлсөн</th>
              <th className={`${thClass} text-right`}>Босго</th>
              {canCost && <th className={`${thClass} text-right`}>Өртөг</th>}
              <th className={`${thClass} text-right`}>Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const isLow = v.stock <= v.lowStockAt;
              const label = `${v.product.name} · ${v.size}`;
              return (
                <tr key={v.id} className={isLow ? "bg-red-50/60" : "hover:bg-navy/[0.02]"}>
                  <td className={tdClass}>
                    <Link href={`/admin/inventory/${v.id}`} className="font-medium hover:underline">{v.product.name}</Link>
                    <span className="text-navy/50"> · {v.size}</span>
                    {!v.isActive && <span className="ml-2"><Badge>Идэвхгүй</Badge></span>}
                  </td>
                  <td className={`${tdClass} font-mono text-[12px]`}>{v.sku}</td>
                  <td className={`${tdClass} text-right tabular-nums ${isLow ? "font-medium text-red-700" : ""}`}>{v.stock}</td>
                  <td className={`${tdClass} text-right tabular-nums text-navy/60`}>{v.reserved}</td>
                  <td className={`${tdClass} text-right tabular-nums text-navy/60`}>{v.lowStockAt}</td>
                  {canCost && <td className={`${tdClass} text-right tabular-nums`}>{v.costPrice != null ? formatMNT(v.costPrice) : "—"}</td>}
                  <td className={tdClass}>
                    {canWrite ? (
                      <StockActions variantId={v.id} label={label} stock={v.stock} costPrice={v.costPrice ?? undefined} />
                    ) : (
                      <div className="text-right">
                        <Link href={`/admin/inventory/${v.id}`} className="text-[13px] underline underline-offset-4">Түүх</Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/inventory" params={{ q, low: low ? "1" : undefined, inactive: inactive ? "1" : undefined }} />
    </>
  );
}
