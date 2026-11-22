import { t } from "@/i18n";
import type { Permission } from "@/server/auth/permissions";

export type NavIcon =
  | "dashboard" | "schedule" | "product" | "service" | "stock" | "collection" | "content" | "users"
  | "calendar" | "pos" | "orders" | "customers" | "shift" | "report" | "payroll";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  permission: Permission;
  soon?: boolean;
};

// Filtered by permission in layout.tsx; every page re-checks its own permission.
export const ADMIN_NAV: AdminNavItem[] = [
  // Dashboard — MANAGER, ADMIN (STAFF is sent to their schedule)
  { href: "/admin", label: t.admin.nav.dashboard, icon: "dashboard", permission: "schedule:all" },
  { href: "/admin/schedule", label: t.admin.nav.schedule, icon: "schedule", permission: "schedule:own" },
  { href: "/admin/pos", label: t.admin.nav.pos, icon: "pos", permission: "pos:use" },
  { href: "/admin/sales", label: t.admin.nav.sales, icon: "orders", permission: "sale:read" },
  { href: "/admin/customers", label: t.admin.nav.customers, icon: "customers", permission: "customer:read" },
  { href: "/admin/shifts", label: t.admin.nav.shifts, icon: "shift", permission: "shift:own" },
  { href: "/admin/products", label: t.admin.nav.products, icon: "product", permission: "product:write" },
  { href: "/admin/services", label: t.admin.nav.services, icon: "service", permission: "service:write" },
  { href: "/admin/inventory", label: t.admin.nav.inventory, icon: "stock", permission: "stock:read" },
  { href: "/admin/collections", label: t.admin.nav.collections, icon: "collection", permission: "product:write" },
  { href: "/admin/content", label: t.admin.nav.content, icon: "content", permission: "settings:write" },
  { href: "/admin/users", label: t.admin.nav.users, icon: "users", permission: "user:write" },
  { href: "/admin/calendar", label: t.admin.nav.calendar, icon: "calendar", permission: "schedule:all", soon: true },
  { href: "/admin/reports", label: t.admin.nav.reports, icon: "report", permission: "report:read", soon: true },
  { href: "/admin/payroll", label: t.admin.nav.payroll, icon: "payroll", permission: "payroll:write", soon: true },
];
