import Link from "next/link";
import { notFound } from "next/navigation";
import { StockActions } from "@/components/admin/inventory/StockActions";
import { Pagination, parsePage } from "@/components/admin/Pagination";
import { Badge, Card, PageHeader, SegmentedTabs, Table, btnClass, tdClass, thClass } from "@/components/admin/ui";
import type { StockMoveType } from "@/generated/prisma/enums";
import { formatMNT } from "@/lib/money";
import { db } from "@/server/db";
import { inventoryAccess, inventoryVariantSelect, redactCost, stockMovementSelect } from "@/server/inventory/visibility";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Хөдөлгөөний түүх" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;
const PAGE_SIZE = 30;
const dt = new Intl.DateTimeFormat("mn-MN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ulaanbaatar" });

const TYPE_LABEL: Record<StockMoveType, string> = {
  PURCHASE: "Орлого",
  SALE: "Борлуулалт",
  SERVICE_USE: "Үйлчилгээнд",
  RETURN: "Буцаалт",
  ADJUSTMENT: "Тооллого",
};

export default async function VariantHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ variantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePagePermission("stock:read");
  const { variantId } = await params;
  const sp = await searchParams;
  const page = parsePage(sp.page);
  // PROMPT 27: хөдөлгөөний шүүлтүүр — зарагдсан (борлуулалт + буцаалт) / үйлчилгээнд / орлого / тооллого
  const FILTERS = { sold: ["SALE", "RETURN"], service: ["SERVICE_USE"], received: ["PURCHASE"], count: ["ADJUSTMENT"] } as const satisfies Record<string, readonly StockMoveType[]>;
  const filter = (Object.keys(FILTERS) as (keyof typeof FILTERS)[]).find((k) => k === sp.type) ?? null;
  const typeWhere = filter ? { type: { in: [...FILTERS[filter]] } } : {};

  const access = inventoryAccess(user.role);
  const found = await db.variant.findUnique({ where: { id: variantId }, select: inventoryVariantSelect(user.role) });
  if (!found) notFound();
  const variant = redactCost(found, user.role);

  const [total, rawMovements, sum] = await Promise.all([
    db.stockMovement.count({ where: { variantId, ...typeWhere } }),
    db.stockMovement.findMany({
      where: { variantId, ...typeWhere },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: stockMovementSelect(user.role),
    }),
    db.stockMovement.aggregate({ where: { variantId }, _sum: { qty: true } }),
  ]);
  const movements = rawMovements.map((m) => redactCost(m, user.role));
  const ledger = sum._sum.qty ?? 0;
  const canCost = access.canSeeCost;

  return (
    <>
      <PageHeader
        title={`${variant.product.name} · ${variant.size}`}
        eyebrow="Үлдэгдэл"
        description={<span>Барааны код: <span className="font-mono text-[14px]">{variant.sku}</span></span>}
        actions={
          <>
            <Link href="/admin/inventory" className={btnClass("secondary")}>← Үлдэгдэл</Link>
            {access.canWrite && (
              <StockActions variantId={variant.id} label={variant.size} stock={variant.stock} costPrice={variant.costPrice ?? undefined} />
            )}
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-[13px] text-ink-soft">Үлдэгдэл</p><p className={`mt-1 text-[26px] font-light ${variant.stock <= variant.lowStockAt ? "text-danger" : ""}`}>{variant.stock}</p></Card>
        <Card><p className="text-[13px] text-ink-soft">Нөөцөлсөн</p><p className="mt-1 text-[26px] font-light">{variant.reserved}</p></Card>
        <Card>
          <p className="text-[13px] text-ink-soft">Хөдөлгөөний нийлбэр</p>
          <p className="mt-1 text-[26px] font-light">{ledger}</p>
          {ledger !== variant.stock && <Badge tone="red">Кэш зөрүүтэй!</Badge>}
        </Card>
      </div>

      <SegmentedTabs
        className="mb-4"
        label="Хөдөлгөөн"
        value={filter ?? "all"}
        items={[
          { value: "all", label: "Бүгд", href: `/admin/inventory/${variant.id}` },
          { value: "sold", label: "Зарагдсан", href: `/admin/inventory/${variant.id}?type=sold` },
          { value: "service", label: "Үйлчилгээнд", href: `/admin/inventory/${variant.id}?type=service` },
          { value: "received", label: "Орлого", href: `/admin/inventory/${variant.id}?type=received` },
          { value: "count", label: "Тооллого", href: `/admin/inventory/${variant.id}?type=count` },
        ]}
      />
      <Table>
        <thead>
          <tr>
            <th className={thClass}>Огноо</th>
            <th className={thClass}>Төрөл</th>
            <th className={`${thClass} text-right`}>Тоо</th>
            {canCost && <th className={`${thClass} text-right`}>Нэгж өртөг</th>}
            <th className={thClass}>Тэмдэглэл</th>
            <th className={thClass}>Хэн</th>
          </tr>
        </thead>
        <tbody>
          {movements.length === 0 && (
            <tr><td colSpan={6} className={`${tdClass} py-8 text-center text-ink-soft`}>Хөдөлгөөн алга.</td></tr>
          )}
          {movements.map((m) => (
            <tr key={m.id}>
              <td className={`${tdClass} whitespace-nowrap`}>{dt.format(m.createdAt)}</td>
              <td className={tdClass}><Badge tone={m.qty > 0 ? "green" : "amber"}>{TYPE_LABEL[m.type]}</Badge></td>
              <td className={`${tdClass} text-right tabular-nums ${m.qty > 0 ? "text-ok" : "text-danger"}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
              {canCost && <td className={`${tdClass} text-right tabular-nums`}>{m.unitCost != null ? formatMNT(m.unitCost) : "—"}</td>}
              <td className={`${tdClass} max-w-[320px]`}>{m.sale ? `Борлуулалт ${m.sale.number}` : m.type === "SERVICE_USE" ? [m.service?.name, m.staff?.name, m.note].filter(Boolean).join(" · ") || "—" : (m.note ?? "—")}</td>
              <td className={tdClass}>{m.createdBy?.name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath={`/admin/inventory/${variant.id}`} params={{ type: filter ?? undefined }} />
    </>
  );
}
