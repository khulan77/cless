import Link from "next/link";
import { notFound } from "next/navigation";
import { RefundButton, ResendEmailButton } from "@/components/admin/sales/SaleActions";
import { Badge, Card, PageHeader, btnClass, tdClass, thClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { saleStatusTone } from "@/lib/sale-status";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { getSaleDetail } from "@/server/modules/sales/queries";
import { concernNames } from "@/server/modules/visits/service";
import { VisitSummary } from "@/components/admin/visits/VisitSummary";
import { ubDateKey } from "@/lib/time";
import { SellerSelect } from "@/components/admin/sales/SellerSelect";
import { db } from "@/server/db";

export const metadata = { title: "Борлуулалт" };
export const instant = false;

const dt = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Asia/Ulaanbaatar", dateStyle: "short", timeStyle: "short" });

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("sale:read");
  const { id } = await params;
  const sale = await getSaleDetail(id);
  if (!sale) notFound();

  const concerns = sale.visit ? await concernNames(sale.visit.concerns) : [];
  const refundable = can(user.role, "sale:refund") && (sale.status === "PAID" || sale.status === "PARTIALLY_REFUNDED");
  const resumable = ["DRAFT", "PENDING_PAYMENT", "PARTIALLY_PAID"].includes(sale.status) && can(user.role, "pos:use");
  // "Зарсан" ажилтныг засах (PROMPT 14 §5): ADMIN, MANAGER — идэвхтэй ажилтнууд (нягтлангүй)
  const canSeller = can(user.role, "sale:seller") && sale.items.some((i) => i.kind === "PRODUCT");
  const sellerOptions = canSeller
    ? await db.user.findMany({ where: { isActive: true, role: { not: "ACCOUNTANT" } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

  return (
    <>
      <PageHeader
        title={sale.number ?? t.admin.saleStatus.DRAFT}
        description={
          <span className="inline-flex items-center gap-2">
            <Badge tone={saleStatusTone(sale.status)}>{t.admin.saleStatus[sale.status]}</Badge>
            {dt(sale.createdAt)} · {sale.createdBy.name}
          </span>
        }
        actions={
          <>
            {resumable && (
              <Link href={`/admin/pos?sale=${sale.id}`} className={btnClass("primary")}>
                Үргэлжлүүлэх
              </Link>
            )}
            {sale.number && (
              <Link href={`/admin/sales/${sale.id}/receipt`} target="_blank" className={btnClass("secondary")}>
                Баримт
              </Link>
            )}
            {refundable && (
              <RefundButton
                saleId={sale.id}
                methods={[...new Set(sale.payments.filter((p) => p.status === "SUCCEEDED").map((p) => p.method))]}
                lines={sale.items.map((i) => ({ id: i.id, name: i.nameSnapshot, qty: i.qty, refundedQty: i.refundedQty, lineTotal: i.lineTotal, kind: i.kind }))}
              />
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card title="Мөрүүд">
            <table className="-mx-5 -my-5 w-[calc(100%+40px)] text-[14px]">
              <thead>
                <tr>
                  <th className={thClass}>Нэр</th>
                  <th className={`${thClass} text-right`}>Тоо</th>
                  <th className={`${thClass} text-right`}>Үнэ</th>
                  <th className={`${thClass} text-right`}>Хөнгөлөлт</th>
                  <th className={`${thClass} text-right`}>Дүн</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((i) => (
                  <tr key={i.id}>
                    <td className={tdClass}>
                      {i.nameSnapshot}
                      <span className="block text-[13px] text-ink-soft">
                        {i.skuSnapshot ?? (i.staff ? `Ажилтан: ${i.staff.name}` : "")}
                        {i.lineDiscountReason ? ` · ${i.lineDiscountReason}` : ""}
                        {i.refundedQty > 0 ? ` · буцаасан ${i.refundedQty}` : ""}
                        {i.kind === "PRODUCT" && !canSeller && ` · ${t.admin.pos.sellerPrefix} ${i.seller?.name ?? "—"}`}
                      </span>
                      {i.kind === "PRODUCT" && canSeller && <SellerSelect saleId={sale.id} itemId={i.id} value={i.sellerId ?? ""} options={sellerOptions} />}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{i.qty}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(i.unitPrice)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{i.lineDiscount + i.allocatedSaleDiscount > 0 ? `−${formatMNT(i.lineDiscount + i.allocatedSaleDiscount)}` : "—"}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Төлбөрүүд">
            {sale.payments.length === 0 ? (
              <p className="text-[14px] text-ink-soft">Төлбөр алга.</p>
            ) : (
              <ul className="-my-2 divide-y divide-hairline text-[14px]">
                {sale.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {t.admin.payMethod[p.method]}
                      <span className="ml-2 text-[13px] text-ink-soft">
                        {p.approvalCode ?? p.externalRef ?? p.transactions[0]?.providerInvoiceId ?? ""}
                        {p.tendered ? ` · өгсөн ${formatMNT(p.tendered)}, хариулт ${formatMNT(p.change ?? 0)}` : ""}
                        {` · ${p.createdBy.name} · ${dt(p.createdAt)}`}
                      </span>
                      {p.reviewReason && <span className="block text-[13px] text-warn">{p.reviewReason}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={p.status === "SUCCEEDED" ? "green" : p.status === "PROCESSING" ? "amber" : "neutral"}>{t.admin.payStatus[p.status]}</Badge>
                      <span className="tabular-nums">{formatMNT(p.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {sale.visit && (
            <Card title="Айлчлал / оношлогоо">
              <VisitSummary
                visit={{
                  conductedBy: sale.visit.conductedBy.name,
                  date: ubDateKey(sale.visit.createdAt),
                  skinType: sale.visit.skinType,
                  concerns,
                  notes: sale.visit.diagnosisNotes,
                  recommendations: sale.visit.recommendations.map((r) => ({
                    id: r.id,
                    name: `${r.variant.product.name} · ${r.variant.size}`,
                    instructions: r.instructions,
                    purchased: r.purchased,
                  })),
                }}
              />
            </Card>
          )}

          {sale.refunds.length > 0 && (
            <Card title="Буцаалт">
              <ul className="-my-2 divide-y divide-hairline text-[14px]">
                {sale.refunds.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 py-2">
                    <span>
                      {t.admin.payMethod[r.method]} · {r.reason}
                      <span className="block text-[13px] text-ink-soft">
                        {r.requestedBy.name} · {dt(r.createdAt)} · {r.restock ? "үлдэгдэлд буцаасан" : "гэмтэлтэй"}
                      </span>
                    </span>
                    <span className="tabular-nums text-danger">−{formatMNT(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Дүн">
            <dl className="space-y-1.5 text-[14px]">
              {[
                ["Дүн", sale.subtotal],
                ["Мөрийн хөнгөлөлт", -sale.lineDiscountTotal],
                ["Нийт хөнгөлөлт", -sale.saleDiscount],
                ["Төлөх", sale.total],
                ["НӨАТ (орсон)", sale.vatTotal],
                ["Төлсөн", sale.paidAmount],
                ["Буцаасан", -sale.refundedAmount],
              ]
                .filter(([, v], i) => i === 0 || i === 3 || v !== 0)
                .map(([k, v]) => (
                  <div key={k as string} className="flex justify-between">
                    <dt className="text-ink-soft">{k}</dt>
                    <dd className="tabular-nums">{formatMNT(v as number)}</dd>
                  </div>
                ))}
            </dl>
            {sale.saleDiscountReason && <p className="mt-2 text-[13px] text-ink-soft">Хөнгөлөлт: {sale.saleDiscountReason}</p>}
            {sale.discountApprovedBy && <p className="mt-1 text-[13px] text-ink-soft">Баталсан: {sale.discountApprovedBy.name}</p>}
          </Card>

          <Card title="Үйлчлүүлэгч">
            {sale.customer ? (
              <Link href={`/admin/customers/${sale.customer.id}`} className="text-[14px] hover:underline">
                {sale.customer.name} · {sale.customer.phone}
              </Link>
            ) : (
              <p className="text-[14px] text-ink-soft">Бүртгэлгүй</p>
            )}
          </Card>

          {sale.visit && (
            <Card title="Айлчлалын имэйл" actions={sale.customer?.email && can(user.role, "visit:write") && <ResendEmailButton visitId={sale.visit.id} />}>
              <p className="text-[14px]">
                <Badge tone={sale.visit.emailStatus === "SENT" ? "green" : sale.visit.emailStatus === "FAILED" ? "red" : "neutral"}>
                  {t.admin.emailStatus[sale.visit.emailStatus]}
                </Badge>
                {sale.visit.emailSentAt && <span className="ml-2 text-[13px] text-ink-soft">{dt(sale.visit.emailSentAt)}</span>}
              </p>
              {sale.visit.emailError && <p className="mt-2 text-[13px] text-danger">{sale.visit.emailError}</p>}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
