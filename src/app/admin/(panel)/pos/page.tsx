import Link from "next/link";
import { PosTerminal, type PosResume } from "@/components/admin/pos/PosTerminal";
import { Badge, PageHeader, btnClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { getOpenShift } from "@/server/modules/cash-shifts/service";
import { effectiveQPayMode } from "@/server/modules/payments/providers/qpay";
import { getPosSale, listServiceStaff, openPosSales } from "@/server/modules/sales/queries";
import { getPosSettings, getQPaySettings, getTaxSettings } from "@/server/modules/settings/pos-settings";
import { db } from "@/server/db";

export const metadata = { title: "Касс / POS" };
export const instant = false;

export default async function PosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission("pos:use");
  const sp = await searchParams;
  const saleParam = typeof sp.sale === "string" ? sp.sale : null;

  const branch = await getCurrentBranch();
  const [staff, shift, qpay, pos, tax, open, resumeSale] = await Promise.all([
    listServiceStaff(),
    getOpenShift(db, branch.id),
    getQPaySettings(),
    getPosSettings(),
    getTaxSettings(),
    openPosSales(),
    saleParam ? getPosSale(saleParam) : null,
  ]);

  let resume: PosResume | null = null;
  if (resumeSale && ["DRAFT", "PENDING_PAYMENT", "PARTIALLY_PAID"].includes(resumeSale.status)) {
    resume = {
      sale: {
        id: resumeSale.id,
        number: resumeSale.number ?? "",
        total: resumeSale.total,
        paidAmount: resumeSale.paidAmount,
        status: resumeSale.status,
        draft: resumeSale.status === "DRAFT",
      },
      payments: resumeSale.payments.map((p) => ({ id: p.id, method: p.method, amount: p.amount, status: p.status, change: p.change, reviewReason: p.reviewReason })),
      lines: resumeSale.items.map((i) => ({
        key: i.id,
        kind: i.kind === "SERVICE" ? "SERVICE" : "PRODUCT",
        refId: (i.kind === "SERVICE" ? i.serviceId : i.variantId) ?? "",
        name: i.nameSnapshot,
        detail: i.skuSnapshot ?? "",
        unitPrice: i.unitPrice,
        qty: i.qty,
        staffId: i.staffId ?? "",
        discount: i.lineDiscount > 0 ? { type: "AMOUNT", value: i.lineDiscount } : null,
        discountReason: i.lineDiscountReason ?? "",
      })),
      customer: resumeSale.customer,
      visitId: resumeSale.visit?.id ?? null,
      saleDiscount: resumeSale.saleDiscount > 0 ? { type: "AMOUNT", value: resumeSale.saleDiscount } : null,
      saleDiscountReason: resumeSale.saleDiscountReason ?? "",
    };
  }

  return (
    <>
      <PageHeader
        title="Касс / POS"
        description={
          shift ? (
            <span className="inline-flex items-center gap-2">
              <Badge tone="green">Касс нээлттэй</Badge> {branch.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Badge tone="amber">Касс хаалттай</Badge>
              <Link href="/admin/shifts" className="underline underline-offset-4">
                Касс нээх
              </Link>
            </span>
          )
        }
        actions={
          open.length > 0 && (
            <details className="relative">
              <summary className={btnClass("secondary")}>
                {t.admin.pos.openSales} ({open.length})
              </summary>
              <ul className="absolute right-0 z-10 mt-1 w-80 divide-y divide-line rounded-md border border-line bg-white text-[13px] shadow-lg">
                {open.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/pos?sale=${o.id}`} className="flex justify-between gap-2 px-3 py-2 hover:bg-navy/[0.03]">
                      <span>
                        {o.number ?? t.admin.saleStatus.DRAFT} · {o.customer?.name ?? "—"}
                        <span className="block text-[11px] text-navy/50">{t.admin.saleStatus[o.status]}</span>
                      </span>
                      <span className="tabular-nums">{formatMNT(o.total - o.paidAmount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )
        }
      />
      <PosTerminal
        key={resume?.sale.id ?? "new"}
        staff={staff}
        qpayMode={effectiveQPayMode(qpay.mode)}
        shiftOpen={Boolean(shift)}
        canTransfer={can(user.role, "payment:transfer:confirm")}
        maxDiscountPercent={can(user.role, "discount:over-limit") ? 100 : pos.maxManagerDiscountPercent}
        vat={{ included: tax.vatIncluded, rateBp: tax.vatRateBp }}
        resume={resume}
      />
    </>
  );
}
