import { SegmentedTabs } from "@/components/admin/ui";
import { t } from "@/i18n";

const M = t.admin.me;
type MeTab = "schedule" | "customers" | "sales";
const PATHS: Record<MeTab, string> = { schedule: "/admin/schedule", customers: "/admin/me/customers", sales: "/admin/me/sales" };

/** Гоо сайханчийн "Миний самбар" — хуваарь · үйлчлүүлэгчид · борлуулалт */
export function MeTabs({ active }: { active: MeTab }) {
  return <SegmentedTabs label={M.title} value={active} items={(Object.keys(PATHS) as MeTab[]).map((k) => ({ value: k, label: M.tabs[k], href: PATHS[k] }))} />;
}
