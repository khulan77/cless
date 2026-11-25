import { SegmentedTabs } from "@/components/admin/ui";
import { t } from "@/i18n";

const R = t.admin.report;
export type ReportTab = "overview" | "products" | "cancellations";
const PATHS: Record<ReportTab, string> = { overview: "/admin", products: "/admin/reports/products", cancellations: "/admin/reports/cancellations" };

/** Тайлангийн дэд хуудсууд — хугацаа (?from=&to=) хадгалагдана */
export function ReportTabs({ active, from, to }: { active: ReportTab; from: string; to: string }) {
  const q = `?from=${from}&to=${to}`;
  return (
    <SegmentedTabs
      label={R.title}
      value={active}
      items={(Object.keys(PATHS) as ReportTab[]).map((k) => ({ value: k, label: R.tabs[k], href: PATHS[k] + q }))}
    />
  );
}
