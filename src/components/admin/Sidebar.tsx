"use client";

import {
  Banknote, BarChart3, Boxes, CalendarClock, CalendarDays, Contact, CreditCard, FileText, FolderTree, LayoutDashboard,
  LogOut, Menu, Package, Receipt, Sparkles, Users, Wallet, X, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { AdminNavItem, NavIcon } from "./nav";
import { t } from "@/i18n";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  schedule: CalendarClock,
  product: Package,
  service: Sparkles,
  stock: Boxes,
  collection: FolderTree,
  content: FileText,
  users: Users,
  calendar: CalendarDays,
  pos: CreditCard,
  orders: Receipt,
  customers: Contact,
  shift: Banknote,
  report: BarChart3,
  payroll: Wallet,
};

type Props = {
  items: AdminNavItem[];
  user: { name: string; email: string; roleLabel: string };
  logout: () => Promise<void>;
};

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ items, user, logout }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile menu on navigation (state update during render)
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const main = items.filter((i) => !i.soon);
  const soon = items.filter((i) => i.soon);

  const nav = (
    <div className="flex h-full flex-col">
      <Link href="/admin" className="flex flex-col px-5 pb-6 pt-6 font-serif leading-none">
        <span className="text-[13px] tracking-[0.3em]">BIOLOGIQUE</span>
        <span className="text-[13px] tracking-[0.3em]">RECHERCHE</span>
        <span className="mt-2 font-sans text-[11px] tracking-[0.4px] text-navy/50">{t.admin.panelName}</span>
      </Link>
      <nav aria-label={t.admin.menu} className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {main.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[14px] ${
                    active ? "bg-navy text-white" : "text-navy/80 hover:bg-navy/5"
                  }`}
                >
                  <Icon className="size-4" strokeWidth={1.5} aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {soon.length > 0 && (
          <>
            <p className="mt-6 px-2.5 pb-1.5 text-[11px] uppercase tracking-[0.5px] text-navy/40">{t.admin.soon}</p>
            <ul className="space-y-0.5">
              {soon.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <span aria-disabled className="flex h-9 cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 text-[14px] text-navy/35">
                      <Icon className="size-4" strokeWidth={1.5} aria-hidden />
                      {item.label}
                      <span className="ml-auto rounded bg-navy/5 px-1.5 text-[10px] text-navy/50">{t.admin.soon}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>
      <div className="border-t border-line p-3">
        <div className="px-2 pb-2">
          <p className="truncate text-[14px] font-medium">{user.name}</p>
          <p className="truncate text-[12px] text-navy/55">
            {user.roleLabel} · {user.email}
          </p>
        </div>
        <form action={logout}>
          <button type="submit" className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[14px] text-navy/80 hover:bg-navy/5">
            <LogOut className="size-4" strokeWidth={1.5} aria-hidden />
            {t.admin.logout}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white px-3 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label={t.admin.openMenu} className="grid size-9 place-items-center rounded hover:bg-navy/5">
          <Menu className="size-5" strokeWidth={1.5} />
        </button>
        <span className="font-serif text-[12px] tracking-[0.3em]">BIOLOGIQUE RECHERCHE</span>
      </div>

      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-line bg-white lg:block">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t.admin.menu}>
          <div className="absolute inset-0 bg-navy/30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-xl">
            <button type="button" onClick={() => setOpen(false)} aria-label={t.admin.closeMenu} className="absolute right-2 top-2 grid size-9 place-items-center rounded hover:bg-navy/5">
              <X className="size-5" strokeWidth={1.5} />
            </button>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
