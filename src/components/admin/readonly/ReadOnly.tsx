"use client";

import { Eye } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { t } from "@/i18n";

/**
 * Зөвхөн харах горим (ACCOUNTANT): доторх бүх input, товчийг идэвхгүй болгоно (`<fieldset disabled>`).
 * Зөвхөн UI — server action бүр өөрийн эрхээр хориотой хэвээр (accountant-readonly.test.ts).
 */
export function ReadOnlyFieldset({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  if (!readOnly) return <>{children}</>;
  return (
    <fieldset disabled aria-disabled className="contents [&_button]:cursor-not-allowed">
      {children}
    </fieldset>
  );
}

/** Хуудасны дээд талын "Зөвхөн харах" тэмдэг — нягтлангийн өөрийн хэсэгт (цалин, ирц харах г.м.) харагдахгүй */
const OWN_AREAS = ["/admin/payroll", "/admin/attendance", "/admin/holidays", "/admin/reports/payroll", "/admin/settings/accountant", "/admin/account"];

export function ReadOnlyBanner() {
  const path = usePathname() ?? "";
  if (OWN_AREAS.some((p) => path.startsWith(p))) return null;
  return (
    <div role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-champagne/40 bg-champagne/10 px-4 py-2.5 text-[14px]">
      <Eye className="size-4 shrink-0" aria-hidden />
      <span className="font-medium">{t.admin.readOnly.badge}</span>
      <span className="text-ink-soft">— {t.admin.readOnly.hint}</span>
    </div>
  );
}
