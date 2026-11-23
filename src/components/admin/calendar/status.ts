import type { ApptStatus, SaleStatus } from "@/generated/prisma/enums";
import { t } from "@/i18n";

/** Badge tone per appointment status */
export const statusTone = (s: ApptStatus): "green" | "neutral" | "red" | "amber" | "navy" =>
  s === "ARRIVED" ? "green" : s === "IN_PROGRESS" ? "amber" : s === "NO_SHOW" || s === "CANCELLED" ? "red" : s === "CONFIRMED" ? "navy" : "neutral";


/** "<number> · <status>"; a draft without a number shows the status once (not "Draft · Draft") */
export function saleLabel(number: string | null, status: SaleStatus): string {
  return number ? `${number} · ${t.admin.saleStatus[status]}` : t.admin.saleStatus[status];
}
