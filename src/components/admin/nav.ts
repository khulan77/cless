import type { Permission } from "@/server/auth/permissions";

export type NavIcon =
  | "dashboard" | "schedule" | "product" | "service" | "stock" | "collection" | "content" | "users"
  | "calendar" | "pos" | "orders" | "report" | "payroll";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  permission: Permission;
  soon?: boolean;
};

// Цэс эрхээр шүүгдэнэ (layout.tsx). Хуудас бүр өөрөө ч эрхээ дахин шалгана.
export const ADMIN_NAV: AdminNavItem[] = [
  // Хянах самбар — MANAGER, ADMIN (STAFF шууд хуваарь руу)
  { href: "/admin", label: "Хянах самбар", icon: "dashboard", permission: "schedule:all" },
  { href: "/admin/schedule", label: "Миний хуваарь", icon: "schedule", permission: "schedule:own" },
  { href: "/admin/products", label: "Бүтээгдэхүүн", icon: "product", permission: "product:write" },
  { href: "/admin/services", label: "Үйлчилгээ", icon: "service", permission: "service:write" },
  { href: "/admin/inventory", label: "Үлдэгдэл", icon: "stock", permission: "stock:read" },
  { href: "/admin/collections", label: "Ангилал", icon: "collection", permission: "product:write" },
  { href: "/admin/content", label: "Сайтын контент", icon: "content", permission: "settings:write" },
  { href: "/admin/users", label: "Хэрэглэгчид", icon: "users", permission: "user:write" },
  { href: "/admin/calendar", label: "Календарь", icon: "calendar", permission: "schedule:all", soon: true },
  { href: "/admin/visits", label: "Айлчлал / POS", icon: "pos", permission: "visit:write", soon: true },
  { href: "/admin/orders", label: "Захиалга", icon: "orders", permission: "sale:write", soon: true },
  { href: "/admin/reports", label: "Тайлан", icon: "report", permission: "report:read", soon: true },
  { href: "/admin/payroll", label: "Цалин", icon: "payroll", permission: "payroll:write", soon: true },
];
