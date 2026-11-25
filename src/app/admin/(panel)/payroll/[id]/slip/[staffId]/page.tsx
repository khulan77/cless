import { notFound } from "next/navigation";
import { Payslip, toPayslipData } from "@/components/admin/payroll/Payslip";
import { PrintButton } from "@/components/admin/sales/SaleActions";
import { t } from "@/i18n";
import { requirePagePermission } from "@/server/auth/session";
import { payslipFor } from "@/server/modules/payroll/periods";
import { getSalonInfo } from "@/server/queries/storefront";

export const metadata = { title: "Цалингийн хуудас" };
export const instant = false;

export default async function PayslipPage({ params }: { params: Promise<{ id: string; staffId: string }> }) {
  await requirePagePermission("payroll:read");
  const { id, staffId } = await params;
  const [line, salon] = await Promise.all([payslipFor(id, staffId), getSalonInfo()]);
  if (!line) notFound();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-[14px] text-ink-soft">{t.admin.payroll.me.printHint}</p>
        <PrintButton />
      </div>
      <Payslip d={toPayslipData(line, salon.name || salon.siteName)} />
    </>
  );
}
