import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/sales/SaleActions";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";
import { getSaleDetail } from "@/server/modules/sales/queries";

export const metadata = { title: "Баримт" };
export const instant = false;

/** 80мм дулааны принтерт тохирсон баримт (eBarimt биш — TODO: eBarimt) */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("sale:read");
  const { id } = await params;
  const sale = await getSaleDetail(id);
  if (!sale || !sale.number) notFound();
  const paid = sale.payments.filter((p) => p.status === "SUCCEEDED");
  const change = paid.reduce((s, p) => s + (p.change ?? 0), 0);

  return (
    <div className="receipt mx-auto w-[300px] bg-white p-4 font-mono text-[12px] leading-[1.45] text-black">
      <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } body * { visibility: hidden; } .receipt, .receipt * { visibility: visible; } .receipt { position: absolute; left: 0; top: 0; width: 72mm; padding: 0; } }`}</style>
      <p className="text-center text-[15px] font-bold tracking-[3px]">{sale.branch.name}</p>
      {sale.branch.address && <p className="text-center">{sale.branch.address}</p>}
      {sale.branch.phone && <p className="text-center">{sale.branch.phone}</p>}
      <p className="mt-2 border-t border-dashed border-black pt-2">{sale.number}</p>
      <p>{(sale.paidAt ?? sale.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Ulaanbaatar" })}</p>
      {sale.customer && <p>{sale.customer.name}</p>}
      <div className="mt-2 border-t border-dashed border-black pt-2">
        {sale.items.map((i) => (
          <div key={i.id} className="mb-1">
            <p>{i.nameSnapshot}</p>
            <p className="flex justify-between">
              <span>
                {i.qty} × {formatMNT(i.unitPrice)}
              </span>
              <span>{formatMNT(i.lineTotal)}</span>
            </p>
            {i.lineDiscount + i.allocatedSaleDiscount > 0 && <p className="text-right">хөнгөлөлт −{formatMNT(i.lineDiscount + i.allocatedSaleDiscount)}</p>}
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-0.5 border-t border-dashed border-black pt-2">
        <p className="flex justify-between">
          <span>Дүн</span>
          <span>{formatMNT(sale.subtotal)}</span>
        </p>
        {sale.lineDiscountTotal + sale.saleDiscount > 0 && (
          <p className="flex justify-between">
            <span>Хөнгөлөлт</span>
            <span>−{formatMNT(sale.lineDiscountTotal + sale.saleDiscount)}</span>
          </p>
        )}
        <p className="flex justify-between text-[14px] font-bold">
          <span>НИЙТ</span>
          <span>{formatMNT(sale.total)}</span>
        </p>
        <p className="flex justify-between">
          <span>НӨАТ (орсон)</span>
          <span>{formatMNT(sale.vatTotal)}</span>
        </p>
        {paid.map((p) => (
          <p key={p.id} className="flex justify-between">
            <span>{t.admin.payMethod[p.method]}</span>
            <span>{formatMNT(p.tendered ?? p.amount)}</span>
          </p>
        ))}
        {change > 0 && (
          <p className="flex justify-between">
            <span>Хариулт</span>
            <span>{formatMNT(change)}</span>
          </p>
        )}
      </div>
      <p className="mt-3 border-t border-dashed border-black pt-2 text-center">Баярлалаа!</p>
      <p className="mt-1 text-center text-[10px]">Энэ нь НӨАТ-ын (eBarimt) баримт биш.</p>
      <div className="mt-4 flex justify-center print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}
