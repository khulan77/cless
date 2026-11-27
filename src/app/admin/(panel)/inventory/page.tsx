import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { StockActions } from "@/components/admin/inventory/StockActions";
import { ServiceUseButton } from "@/components/admin/inventory/ServiceUseButton";
import { ubDateKey, ubDayRange } from "@/lib/time";
import { can } from "@/server/auth/permissions";
import { monthlyFlows } from "@/server/modules/inventory/service-use";
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
  const canIssue = can(user.role, "stock:issue");

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
  // PROMPT 27: энэ сарын зарагдсан / үйлчилгээнд / орлого
  const month = ubDateKey().slice(0, 8) + "01";
  const [flows, staff] = await Promise.all([
    monthlyFlows(variants.map((v) => v.id), ubDayRange(month).start, ubDayRange(ubDateKey()).end),
    canIssue ? db.user.findMany({ where: { isActive: true, role: "STAFF" }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Дэлгүүр"
        title="Үлдэгдэл"
        description={canWrite ? "Үлдэгдэл, энэ сарын зарагдсан / үйлчилгээнд зарцуулсан / орлого — орлого авах, тооллого, үйлчилгээнд олгох" : "Үлдэгдэл, энэ сарын зарлага (засварыг админ хийнэ)"}
      />
      <FilterBar action="/admin/inventory" resetHref={q || low || inactive ? "/admin/inventory" : undefined}>
        <input name="q" defaultValue={q} placeholder="Нэр эсвэл барааны кодоор хайх" aria-label="Хайх" className={`${inputClass} w-80`} />
        <Checkbox name="low" value="1" defaultChecked={low} label="Зөвхөн цөөн үлдсэн" />
        <Checkbox name="inactive" value="1" defaultChecked={inactive} label="Зарагдахаа больсныг харуулах" />
      </FilterBar>

      {variants.length === 0 ? (
        <EmptyState title="Бараа олдсонгүй">Хайлт, шүүлтүүрээ өөрчилж үзнэ үү.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>Бүтээгдэхүүн</th>
              <th className={thClass}>Барааны код</th>
              <th className={`${thClass} text-right`}>Үлдэгдэл</th>
              <th className={`${thClass} text-right`} title="Энэ сар: POS / онлайн борлуулалт (буцаалт хассан)">Зарагдсан</th>
              <th className={`${thClass} text-right`} title="Энэ сар: үйлчилгээнд олгосон">Үйлчилгээнд</th>
              <th className={`${thClass} text-right`} title="Энэ сар: орлого (худалдан авалт)">Орлого</th>
              <th className={`${thClass} text-right`} title="Онлайн төлбөр хүлээж буй">Түр барьсан</th>
              <th className={`${thClass} text-right`} title="Үүнээс доош бол анхааруулна">Доод хэмжээ</th>
              {canCost && <th className={`${thClass} text-right`}>Өртөг</th>}
              <th className={thClass}><span className="sr-only">Үйлдэл</span></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const isLow = v.stock <= v.lowStockAt;
              const label = `${v.product.name} · ${v.size}`;
              return (
                <tr key={v.id} className={isLow ? "bg-err-bg/60" : "hover:bg-canvas"}>
                  <td className={tdClass}>
                    <Link href={`/admin/inventory/${v.id}`} className="font-medium hover:underline">{v.product.name}</Link>
                    <span className="text-ink-soft"> · {v.size}</span>
                    {!v.isActive && <span className="ml-2"><Badge>Зарагдахгүй</Badge></span>}
                  </td>
                  <td className={`${tdClass} font-mono text-[13px]`}>{v.sku}</td>
                  <td className={`${tdClass} text-right tabular-nums ${isLow ? "font-medium text-danger" : ""}`}>{v.stock}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{flows.get(v.id)?.sold || "—"}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{flows.get(v.id)?.serviceUse || "—"}</td>
                  <td className={`${tdClass} text-right tabular-nums text-ink-soft`}>{flows.get(v.id)?.received || "—"}</td>
                  <td className={`${tdClass} text-right tabular-nums text-ink-soft`}>{v.reserved}</td>
                  <td className={`${tdClass} text-right tabular-nums text-ink-soft`}>{v.lowStockAt}</td>
                  {canCost && <td className={`${tdClass} text-right tabular-nums`}>{v.costPrice != null ? formatMNT(v.costPrice) : "—"}</td>}
                  <td className={tdClass}>
                    {canWrite || canIssue ? (
                      <div className="flex justify-end gap-1.5">
                        {canIssue && <ServiceUseButton variantId={v.id} label={label} staff={staff} />}
                        {canWrite && <StockActions variantId={v.id} label={label} stock={v.stock} costPrice={v.costPrice ?? undefined} />}
                      </div>
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
