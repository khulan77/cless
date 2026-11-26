import Link from "next/link";
import { redirect } from "next/navigation";
import { PosTerminal, type PosInitial } from "@/components/admin/pos/PosTerminal";
import { Badge, PageHeader, btnClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { getOpenShift } from "@/server/modules/cash-shifts/service";
import { effectiveQPayMode } from "@/server/modules/payments/providers/qpay";
import { draftDataSchema, latestDraftId, listDrafts, type DraftData } from "@/server/modules/sales/drafts";
import { getPosSale, listServiceStaff, openPosSales } from "@/server/modules/sales/queries";
import { getPosSettings, getQPaySettings, getTaxSettings } from "@/server/modules/settings/pos-settings";
import { listConcerns } from "@/server/modules/visits/service";
import { todayForPos } from "@/server/modules/appointments/queries";
import { formatTime } from "@/lib/time";

export const metadata = { title: "Төлбөр авах" };
export const instant = false;

type PosSale = NonNullable<Awaited<ReturnType<typeof getPosSale>>>;

/** draftData байхгүй (unlock хийсэн) бол мөр, айлчлалаас сэргээнэ */
async function dataFromSale(sale: PosSale): Promise<DraftData> {
  const parsed = sale.draftData ? draftDataSchema.safeParse(sale.draftData) : null;
  if (parsed?.success) return parsed.data;
  const visit = sale.visit
    ? await db.visit.findUnique({
        where: { id: sale.visit.id },
        include: { recommendations: { orderBy: { sortOrder: "asc" }, include: { variant: { select: { size: true, product: { select: { name: true } } } } } } },
      })
    : null;
  return draftDataSchema.parse({
    lines: sale.items.map((i) => ({
      key: i.id,
      kind: i.kind === "SERVICE" ? "SERVICE" : "PRODUCT",
      refId: (i.kind === "SERVICE" ? i.serviceId : i.variantId) ?? "",
      name: i.nameSnapshot,
      detail: i.skuSnapshot ?? "",
      unitPrice: i.unitPrice,
      qty: i.qty,
      staffId: i.staffId ?? "",
      sellerId: i.sellerId ?? "",
      discount: i.lineDiscount > 0 ? { type: "AMOUNT", value: i.lineDiscount } : null,
      discountReason: i.lineDiscountReason ?? "",
    })),
    customer: sale.customer,
    saleDiscount: sale.saleDiscount > 0 ? { type: "AMOUNT", value: sale.saleDiscount } : null,
    saleDiscountReason: sale.saleDiscountReason ?? "",
    visitId: visit?.id ?? null,
    appointmentId: sale.appointmentId,
    visit: visit
      ? {
          skinType: visit.skinType ?? "",
          concerns: visit.concerns,
          notes: visit.diagnosisNotes ?? "",
          recs: visit.recommendations.map((r) => ({ variantId: r.variantId, name: `${r.variant.product.name} · ${r.variant.size}`, instructions: r.instructions ?? "" })),
        }
      : undefined,
  });
}

export default async function PosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission("pos:use");
  const sp = await searchParams;
  const saleParam = typeof sp.sale === "string" ? sp.sale : null;
  const fresh = sp.new === "1";

  // Параметргүй бол хэрэглэгчийн сүүлийн ноорог руу шилжүүлнэ — URL-д saleId байх ёстой,
  // эс тэгвээс lock хийсний дараах refresh өөр (хоосон) сагс ачаална
  if (!saleParam && !fresh) {
    const latest = await latestDraftId(user.id);
    if (latest) redirect(`/admin/pos?sale=${latest}`);
  }

  const branch = await getCurrentBranch();
  const targetId = saleParam;
  const [staff, shift, qpay, pos, tax, open, drafts, concerns, sale, todayAppts] = await Promise.all([
    listServiceStaff(),
    getOpenShift(db, branch.id),
    getQPaySettings(),
    getPosSettings(),
    getTaxSettings(),
    openPosSales(),
    listDrafts(user.id),
    listConcerns(),
    targetId ? getPosSale(targetId) : null,
    can(user.role, "appointment:status") ? todayForPos() : Promise.resolve([]),
  ]);

  let initial: PosInitial = { saleId: null, data: draftDataSchema.parse({}), payment: null };
  if (sale && sale.status === "DRAFT") {
    initial = { saleId: sale.id, data: await dataFromSale(sale), payment: null };
  } else if (sale && (sale.status === "PENDING_PAYMENT" || sale.status === "PARTIALLY_PAID" || sale.status === "PAID")) {
    // PAID: төлбөрийн дараах refresh (server action-ийн кэш шинэчлэл) амжилтын дэлгэцийг хадгална
    initial = {
      saleId: sale.id,
      data: await dataFromSale(sale),
      payment: {
        sale: { id: sale.id, number: sale.number ?? "", total: sale.total, paidAmount: sale.paidAmount, status: sale.status },
        payments: sale.payments.map((p) => ({ id: p.id, method: p.method, amount: p.amount, status: p.status, change: p.change, reviewReason: p.reviewReason })),
      },
    };
  }
  const pending = open.filter((o) => o.status !== "DRAFT");

  return (
    <>
      <PageHeader
        eyebrow="Касс"
        title="Төлбөр авах"
        description={
          !pos.cashShiftsEnabled ? (
            <span className="inline-flex items-center gap-2">
              {branch.name} · бичсэн: {user.name}
            </span>
          ) : shift ? (
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
          pending.length > 0 && (
            <details className="relative">
              <summary className={btnClass("secondary")}>
                {t.admin.pos.openSales} ({pending.length})
              </summary>
              <ul className="absolute right-0 z-10 mt-1 w-80 divide-y divide-hairline rounded-xl border border-hairline bg-white text-[13px] shadow-lg">
                {pending.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/pos?sale=${o.id}`} className="flex justify-between gap-2 px-3 py-2 hover:bg-canvas">
                      <span>
                        {o.number ?? t.admin.saleStatus.DRAFT} · {o.customer?.name ?? "—"}
                        <span className="block text-[13px] text-ink-soft">{t.admin.saleStatus[o.status]}</span>
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
        key={initial.saleId ?? "new"}
        staff={staff}
        cashier={{ id: user.id, name: user.name }}
        qpayMode={effectiveQPayMode(qpay.mode)}
        shiftOpen={!pos.cashShiftsEnabled || Boolean(shift)}
        canTransfer={can(user.role, "payment:transfer:confirm")}
        maxDiscountPercent={can(user.role, "discount:over-limit") ? 100 : pos.maxManagerDiscountPercent}
        vat={{ included: tax.vatIncluded, rateBp: tax.vatRateBp }}
        initial={initial}
        drafts={drafts.map((d) => ({ ...d, updatedAt: d.updatedAt.toISOString() }))}
        concernOptions={concerns}
        todayAppointments={todayAppts.map((a) => ({
          id: a.id,
          time: formatTime(a.startsAt),
          customer: a.customer.name,
          service: a.service.name,
          staff: a.staff.name,
          status: t.admin.apptStatus[a.status],
        }))}
      />
    </>
  );
}
