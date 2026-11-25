import { notFound } from "next/navigation";
import { Payslip, toPayslipData } from "@/components/admin/payroll/Payslip";
import { PrintButton } from "@/components/admin/sales/SaleActions";
import { t } from "@/i18n";
import { requirePagePermission } from "@/server/auth/session";
import { payslipFor } from "@/server/modules/payroll/periods";
import { getSalonInfo } from "@/server/queries/storefront";

export const metadata = { title: "Цалингийн хуудас" };
export const instant = false;

/** Зөвхөн өөрийн, батлагдсан/олгосон үеийн хуудас — бусад тохиолдолд 404 (ноорог байгааг ч задлахгүй) */
export default async function MyPayslipPage({ params }: { params: Promise<{ periodId: string }> }) {
  const user = await requirePagePermission("me:read");
  const { periodId } = await params;
  const [line, salon] = await Promise.all([payslipFor(periodId, user.id), getSalonInfo()]);
  if (!line || line.period.status === "DRAFT") notFound();
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
