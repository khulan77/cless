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

export const metadata = { title: "Борлуулалт" };
export const instant = false;

const dt = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Asia/Ulaanbaatar", dateStyle: "short", timeStyle: "short" });

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("sale:read");
  const { id } = await params;
  const sale = await getSaleDetail(id);
  if (!sale) notFound();

  const refundable = can(user.role, "sale:refund") && (sale.status === "PAID" || sale.status === "PARTIALLY_REFUNDED");
  const resumable = ["DRAFT", "PENDING_PAYMENT", "PARTIALLY_PAID"].includes(sale.status) && can(user.role, "pos:use");

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
            <table className="-mx-5 -my-5 w-[calc(100%+40px)] text-[13.5px]">
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
                      <span className="block text-[12px] text-navy/50">
                        {i.skuSnapshot ?? (i.staff ? `Ажилтан: ${i.staff.name}` : "")}
                        {i.lineDiscountReason ? ` · ${i.lineDiscountReason}` : ""}
                        {i.refundedQty > 0 ? ` · буцаасан ${i.refundedQty}` : ""}
                      </span>
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
              <p className="text-[14px] text-navy/55">Төлбөр алга.</p>
            ) : (
              <ul className="-my-2 divide-y divide-line text-[13.5px]">
                {sale.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {t.admin.payMethod[p.method]}
                      <span className="ml-2 text-[12px] text-navy/50">
                        {p.approvalCode ?? p.externalRef ?? p.transactions[0]?.providerInvoiceId ?? ""}
                        {p.tendered ? ` · өгсөн ${formatMNT(p.tendered)}, хариулт ${formatMNT(p.change ?? 0)}` : ""}
                        {` · ${p.createdBy.name} · ${dt(p.createdAt)}`}
                      </span>
                      {p.reviewReason && <span className="block text-[12px] text-amber-800">{p.reviewReason}</span>}
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

          {sale.refunds.length > 0 && (
            <Card title="Буцаалт">
              <ul className="-my-2 divide-y divide-line text-[13.5px]">
                {sale.refunds.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 py-2">
                    <span>
                      {t.admin.payMethod[r.method]} · {r.reason}
                      <span className="block text-[12px] text-navy/50">
                        {r.requestedBy.name} · {dt(r.createdAt)} · {r.restock ? "үлдэгдэлд буцаасан" : "гэмтэлтэй"}
                      </span>
                    </span>
                    <span className="tabular-nums text-red-700">−{formatMNT(r.amount)}</span>
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
                    <dt className="text-navy/65">{k}</dt>
                    <dd className="tabular-nums">{formatMNT(v as number)}</dd>
                  </div>
                ))}
            </dl>
            {sale.saleDiscountReason && <p className="mt-2 text-[12px] text-navy/55">Хөнгөлөлт: {sale.saleDiscountReason}</p>}
            {sale.discountApprovedBy && <p className="mt-1 text-[12px] text-navy/55">Баталсан: {sale.discountApprovedBy.name}</p>}
          </Card>

          <Card title="Үйлчлүүлэгч">
            {sale.customer ? (
              <Link href={`/admin/customers/${sale.customer.id}`} className="text-[14px] hover:underline">
                {sale.customer.name} · {sale.customer.phone}
              </Link>
            ) : (
              <p className="text-[14px] text-navy/55">Бүртгэлгүй</p>
            )}
          </Card>

          {sale.visit && (
            <Card title="Айлчлалын имэйл" actions={sale.customer?.email && <ResendEmailButton visitId={sale.visit.id} />}>
              <p className="text-[14px]">
                <Badge tone={sale.visit.emailStatus === "SENT" ? "green" : sale.visit.emailStatus === "FAILED" ? "red" : "neutral"}>
                  {t.admin.emailStatus[sale.visit.emailStatus]}
                </Badge>
                {sale.visit.emailSentAt && <span className="ml-2 text-[12px] text-navy/55">{dt(sale.visit.emailSentAt)}</span>}
              </p>
              {sale.visit.emailError && <p className="mt-2 text-[12px] text-red-700">{sale.visit.emailError}</p>}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
