/** Төлбөрийн хэлбэрийн нэр. PROMPT 29: QPay — дансаар ("QPay — Компанийн данс"). Client/server хоёуланд. */
import { t } from "@/i18n";

export type QPayLabels = Record<"A" | "B", string>;

export function payLabel(method: string, account: "A" | "B" | null | undefined, labels: QPayLabels | null, sep = " — "): string {
  const base = t.admin.payMethod[method as keyof typeof t.admin.payMethod] ?? method;
  return method === "QPAY" && labels ? `${base}${sep}${labels[account ?? "A"]}` : base;
}
