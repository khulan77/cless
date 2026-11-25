import { SegmentedTabs } from "@/components/admin/ui";
import { t } from "@/i18n";

const R = t.admin.report;
export type ReportTab = "overview" | "products" | "cancellations" | "payroll";
const PATHS: Record<ReportTab, string> = {
  overview: "/admin",
  products: "/admin/reports/products",
  cancellations: "/admin/reports/cancellations",
  payroll: "/admin/reports/payroll",
};

/** Тайлангийн дэд хуудсууд — хугацаа (?from=&to=) хадгалагдана. «Цалин» — зөвхөн payroll:read эрхтэй (showPayroll). */
export function ReportTabs({ active, from, to, showPayroll }: { active: ReportTab; from: string; to: string; showPayroll?: boolean }) {
  const q = `?from=${from}&to=${to}`;
  return (
    <SegmentedTabs
      label={R.title}
      value={active}
      items={(Object.keys(PATHS) as ReportTab[])
        .filter((k) => k !== "payroll" || showPayroll)
        .map((k) => ({ value: k, label: R.tabs[k], href: k === "payroll" ? PATHS[k] : PATHS[k] + q }))}
    />
  );
}
