import type { ApptStatus, SaleStatus } from "@/generated/prisma/enums";
import { t } from "@/i18n";

/** Badge tone per appointment status */
export const statusTone = (s: ApptStatus): "green" | "neutral" | "red" | "amber" | "navy" =>
  s === "ARRIVED" ? "green" : s === "IN_PROGRESS" ? "amber" : s === "NO_SHOW" || s === "CANCELLED" ? "red" : s === "CONFIRMED" ? "navy" : "neutral";

/** Calendar card colours per status */
export const cardClass: Record<ApptStatus, string> = {
  BOOKED: "border-navy/30 bg-[#e8ecf4] text-navy",
  CONFIRMED: "border-navy bg-navy text-white",
  ARRIVED: "border-emerald-600 bg-emerald-100 text-emerald-900",
  IN_PROGRESS: "border-amber-500 bg-amber-100 text-amber-900",
  DONE: "border-line bg-[#eeeeec] text-navy/55",
  CANCELLED: "border-line bg-white text-navy/40 line-through",
  NO_SHOW:
    "border-red-300 bg-[repeating-linear-gradient(135deg,#fef2f2_0,#fef2f2_6px,#fde2e2_6px,#fde2e2_12px)] text-red-800",
};

/** "<number> · <status>"; a draft without a number shows the status once (not "Draft · Draft") */
export function saleLabel(number: string | null, status: SaleStatus): string {
  return number ? `${number} · ${t.admin.saleStatus[status]}` : t.admin.saleStatus[status];
}
