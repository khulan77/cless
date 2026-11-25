import { t } from "@/i18n";
import type { Permission } from "@/server/auth/permissions";

export type NavIcon =
  | "dashboard" | "report" | "calendar" | "schedule" | "account"
  | "cash" | "pos" | "orders" | "shift"
  | "people" | "customers" | "inquiries"
  | "shop" | "product" | "stock" | "collection" | "content"
  | "spa" | "service" | "staffSchedule" | "room"
  | "settings" | "salon" | "storefront" | "discount" | "email" | "accountant" | "payments" | "users" | "system"
  | "payroll" | "attendance" | "wallet" | "holiday";

export type NavLeaf = {
  href: string;
  label: string;
  icon: NavIcon;
  permission: Permission;
  /** Also shown (read-only) to roles with this permission — e.g. "admin:view" for ACCOUNTANT */
  view?: Permission;
  /** Hidden for roles that have this permission (STAFF-only items) */
  hiddenWith?: Permission;
};
/** `collapsible` groups (only Тохиргоо) fold open/closed; the rest are flat sections with a small heading */
export type NavGroup = { id: string; label: string; icon: NavIcon; children: NavLeaf[]; collapsible?: boolean };
export type NavEntry = NavLeaf | NavGroup;

export const isGroup = (e: NavEntry): e is NavGroup => "children" in e;

const n = t.admin.nav;

// Filtered by permission in layout.tsx (a group with no visible child disappears); every page re-checks its own permission.
export const ADMIN_NAV: NavEntry[] = [
  { href: "/admin", label: n.dashboard, icon: "report", permission: "schedule:all" },
  { href: "/admin/calendar", label: n.calendar, icon: "calendar", permission: "appointment:read" },
  // STAFF: their own schedule + account (no groups)
  { href: "/admin/schedule", label: n.schedule, icon: "schedule", permission: "schedule:own", hiddenWith: "schedule:all" },
  { href: "/admin/me/customers", label: n.myCustomers, icon: "customers", permission: "me:read", hiddenWith: "schedule:all" },
  { href: "/admin/me/sales", label: n.mySales, icon: "orders", permission: "me:read", hiddenWith: "schedule:all" },
  { href: "/admin/me/payroll", label: n.myPayroll, icon: "wallet", permission: "me:read", hiddenWith: "schedule:all" },
  { href: "/admin/account", label: n.account, icon: "account", permission: "schedule:own", hiddenWith: "schedule:all" },
  {
    id: "cash",
    label: n.groups.cash,
    icon: "cash",
    children: [
      { href: "/admin/pos", label: n.pos, icon: "pos", permission: "pos:use" },
      { href: "/admin/sales", label: n.sales, icon: "orders", permission: "sale:read" },
      { href: "/admin/shifts", label: n.shifts, icon: "shift", permission: "shift:own", view: "admin:view" },
    ],
  },
  {
    id: "people",
    label: n.groups.people,
    icon: "people",
    children: [
      { href: "/admin/customers", label: n.customers, icon: "customers", permission: "customer:read" },
      { href: "/admin/inquiries", label: n.inquiries, icon: "inquiries", permission: "inquiry:manage" },
    ],
  },
  {
    id: "shop",
    label: n.groups.shop,
    icon: "shop",
    children: [
      { href: "/admin/products", label: n.products, icon: "product", permission: "product:write", view: "admin:view" },
      { href: "/admin/inventory", label: n.inventory, icon: "stock", permission: "stock:read" },
      { href: "/admin/collections", label: n.collections, icon: "collection", permission: "product:write", view: "admin:view" },
      { href: "/admin/content", label: n.content, icon: "content", permission: "settings:write" },
    ],
  },
  {
    id: "spa",
    label: n.groups.spa,
    icon: "spa",
    children: [
      { href: "/admin/services", label: n.services, icon: "service", permission: "service:write", view: "admin:view" },
      { href: "/admin/staff-schedules", label: n.staffSchedules, icon: "staffSchedule", permission: "staff-schedule:write", view: "admin:view" },
    ],
  },
  {
    id: "payroll",
    label: n.groups.payroll,
    icon: "payroll",
    children: [
      { href: "/admin/attendance", label: n.attendance, icon: "attendance", permission: "attendance:read" },
      { href: "/admin/payroll", label: n.payrollPeriods, icon: "payroll", permission: "payroll:read" },
      { href: "/admin/payroll/staff", label: n.payrollStaff, icon: "wallet", permission: "payroll:write" },
      { href: "/admin/payroll/settings", label: n.payrollSettings, icon: "accountant", permission: "payroll:settings" },
    ],
  },
  {
    id: "settings",
    label: n.groups.settings,
    icon: "settings",
    collapsible: true,
    children: [
      { href: "/admin/settings/salon", label: n.settingsSalon, icon: "salon", permission: "settings:write" },
      { href: "/admin/settings/shop", label: n.settingsShop, icon: "storefront", permission: "settings:write" },
      { href: "/admin/settings/pos", label: n.settingsPos, icon: "discount", permission: "settings:write" },
      { href: "/admin/holidays", label: n.holidays, icon: "holiday", permission: "holiday:write" },
      { href: "/admin/rooms", label: n.rooms, icon: "room", permission: "room:write" },
      { href: "/admin/settings/email", label: n.settingsEmail, icon: "email", permission: "settings:write" },
      { href: "/admin/settings/accountant", label: n.settingsAccountant, icon: "accountant", permission: "report:send" },
      { href: "/admin/settings/payments", label: n.settingsPayments, icon: "payments", permission: "integration:write" },
      { href: "/admin/users", label: n.users, icon: "users", permission: "user:write", view: "user:write:staff" },
      { href: "/admin/system", label: n.system, icon: "system", permission: "settings:write" },
    ],
  },
];

/** Entries a role may see (groups keep only permitted children; empty groups are dropped) */
export function navFor(can: (p: Permission) => boolean): NavEntry[] {
  const ok = (l: NavLeaf) => (can(l.permission) || (!!l.view && can(l.view))) && !(l.hiddenWith && can(l.hiddenWith));
  return ADMIN_NAV.flatMap<NavEntry>((e) => {
    if (!isGroup(e)) return ok(e) ? [e] : [];
    const children = e.children.filter(ok);
    return children.length ? [{ ...e, children }] : [];
  });
}
