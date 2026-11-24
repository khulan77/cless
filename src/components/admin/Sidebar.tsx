"use client";

import {
  Activity, BadgePercent, BarChart3, Banknote, Boxes, Calculator, CalendarDays, CalendarRange, ChevronDown, ChevronsLeft, ChevronsRight, Contact, CreditCard,
  DoorOpen, FileText, Flower2, FolderTree, Inbox, LayoutDashboard, LogOut, Mail, Menu, Package, Receipt, Settings, ShoppingBag,
  Sparkles, Store, UserCog, UserRound, Users, Wallet, X, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { t } from "@/i18n";
import { Avatar } from "./ui";
import { isGroup, type NavEntry, type NavGroup, type NavIcon, type NavLeaf } from "./nav";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  report: BarChart3,
  calendar: CalendarDays,
  schedule: CalendarRange,
  account: UserRound,
  cash: Wallet,
  pos: CreditCard,
  orders: Receipt,
  shift: Banknote,
  people: Users,
  customers: Contact,
  inquiries: Inbox,
  shop: ShoppingBag,
  product: Package,
  stock: Boxes,
  collection: FolderTree,
  content: FileText,
  spa: Flower2,
  service: Sparkles,
  staffSchedule: CalendarRange,
  room: DoorOpen,
  settings: Settings,
  salon: Store,
  storefront: ShoppingBag,
  discount: BadgePercent,
  email: Mail,
  accountant: Calculator,
  payments: CreditCard,
  users: UserCog,
  system: Activity,
};

const n = t.admin.nav;
const KEY_COLLAPSED = "admin.sidebar.collapsed";

type Props = {
  entries: NavEntry[];
  brand: string;
  user: { name: string; id: string; role: string };
  logout: () => Promise<void>;
};

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

// < 1280px: the sidebar is a rail (icons only)
const NARROW = "(max-width: 1279px)";
const subscribeNarrow = (cb: () => void) => {
  const m = window.matchMedia(NARROW);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // private mode / storage blocked — preference just isn't remembered
  }
}

const leafCls = (active: boolean, child = false) =>
  `relative flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors duration-150 ${
    active ? (child ? "bg-[rgba(184,155,114,0.22)] font-medium text-white" : "bg-white/10 font-medium text-white") : "text-white/72 hover:bg-white/[0.06] hover:text-white"
  }`;
const railBtn = (active: boolean) =>
  `grid size-12 place-items-center rounded-xl transition-colors duration-150 ${active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`;

function Leaf({ item, pathname, child, inRail }: { item: NavLeaf; pathname: string; child?: boolean; inRail?: boolean }) {
  const Icon = ICONS[item.icon];
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={inRail ? item.label : undefined}
      title={inRail ? item.label : undefined}
      className={inRail ? railBtn(active) : leafCls(active, child)}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
      {!inRail && <span className="flex-1 truncate">{item.label}</span>}
      {!inRail && active && <span aria-hidden className="size-1.5 rounded-full bg-champagne" />}
    </Link>
  );
}

export function Sidebar({ entries, brand, user, logout }: Props) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<string[]>([]);
  const [flyout, setFlyout] = useState<{ id: string; top: number } | null>(null);
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const rail = narrow || collapsed;

  // Close the mobile drawer / flyout on navigation (state update during render)
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDrawer(false);
    setFlyout(null);
  }

  // On a page deep in the menu (e.g. Тохиргоо on a short screen) keep the active row in view
  useEffect(() => {
    document.querySelector("aside nav [aria-current=page]")?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  // Restore saved preferences after hydration
  useEffect(() => {
    const c = readJson(KEY_COLLAPSED, false);
    queueMicrotask(() => setCollapsed(c));
  }, []);

  const activeGroup = entries.find((e): e is NavGroup => isGroup(e) && e.children.some((c) => isActive(pathname, c.href)))?.id;
  // Тохиргоо is closed by default and opens only on its own pages (or by hand, for this visit)
  const isOpen = (id: string) => (id === activeGroup ? !open.includes(`-${id}`) : open.includes(id));
  const toggle = (id: string) => {
    if (id === activeGroup) setOpen((o) => (o.includes(`-${id}`) ? o.filter((x) => x !== `-${id}`) : [...o, `-${id}`]));
    else setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  };

  // Consecutive top-level pages form the first section ("Тойм")
  const sections: ({ kind: "leaves"; items: NavLeaf[] } | { kind: "group"; group: NavGroup })[] = [];
  for (const e of entries) {
    if (isGroup(e)) sections.push({ kind: "group", group: e });
    else {
      const last = sections[sections.length - 1];
      if (last?.kind === "leaves") last.items.push(e);
      else sections.push({ kind: "leaves", items: [e] });
    }
  }
  const heading = (label: string) => <p className="px-3 text-[12px] font-semibold uppercase leading-4 tracking-[0.14em] text-white/50">{label}</p>;

  const expandedNav = (
    <div className="space-y-4">
      {sections.map((sec, i) => {
        if (sec.kind === "leaves") {
          return (
            <div key={`l${i}`}>
              {i > 0 && heading(n.groups.overview)}
              <ul className="space-y-0.5">
                {sec.items.map((e) => (
                  <li key={e.href}>
                    <Leaf item={e} pathname={pathname} />
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        const g = sec.group;
        if (!g.collapsible) {
          return (
            <div key={g.id}>
              {heading(g.label)}
              <ul className="space-y-0.5">
                {g.children.map((c) => (
                  <li key={c.href}>
                    <Leaf item={c} pathname={pathname} />
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        const Icon = ICONS[g.icon];
        const opened = isOpen(g.id);
        return (
          <div key={g.id} className="border-t border-white/10 pt-2">
            <button
              type="button"
              aria-expanded={opened}
              aria-controls={`nav-${g.id}`}
              onClick={() => toggle(g.id)}
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] transition-colors duration-150 hover:bg-white/[0.06] hover:text-white ${g.id === activeGroup ? "text-white" : "text-white/72"}`}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
              <span className="flex-1 truncate">{g.label}</span>
              <ChevronDown className={`size-4 shrink-0 text-white/50 transition-transform duration-200 ${opened ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {opened && (
              <ul id={`nav-${g.id}`} className="ml-[21px] border-l border-white/15 pl-3">
                {g.children.map((c) => (
                  <li key={c.href}>
                    <Leaf item={c} pathname={pathname} child />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );

  const railNav = (
    <div className="flex flex-col items-center gap-3">
      {sections.map((sec, i) => {
        const leaves = sec.kind === "leaves" ? sec.items : sec.group.collapsible ? null : sec.group.children;
        if (leaves) {
          return (
            <ul key={sec.kind === "leaves" ? `l${i}` : sec.group.id} className={`flex flex-col items-center gap-1 ${i > 0 ? "border-t border-white/10 pt-3" : ""}`}>
              {leaves.map((e) => (
                <li key={e.href}>
                  <Leaf item={e} pathname={pathname} inRail />
                </li>
              ))}
            </ul>
          );
        }
        const g = (sec as { group: NavGroup }).group;
        const Icon = ICONS[g.icon];
        return (
          <div key={g.id} className="border-t border-white/10 pt-2">
            <button
              type="button"
              aria-label={g.label}
              title={g.label}
              aria-expanded={flyout?.id === g.id}
              aria-haspopup="menu"
              onClick={(ev) => {
                const r = ev.currentTarget.getBoundingClientRect();
                setFlyout(flyout?.id === g.id ? null : { id: g.id, top: r.top });
              }}
              className={railBtn(g.id === activeGroup)}
            >
              <Icon className="size-5" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );

  const flyoutGroup = flyout ? entries.find((e): e is NavGroup => isGroup(e) && e.id === flyout.id) : undefined;

  const collapseBtn = !narrow && (
    <button
      type="button"
      onClick={() => {
        setCollapsed(!collapsed);
        writeJson(KEY_COLLAPSED, !collapsed);
      }}
      className="grid size-9 shrink-0 place-items-center rounded-lg text-white/55 hover:bg-white/[0.08] hover:text-white"
      aria-label={collapsed ? n.expand : n.collapse}
      title={collapsed ? n.expand : n.collapse}
    >
      {collapsed ? <ChevronsRight className="size-[18px]" strokeWidth={1.5} /> : <ChevronsLeft className="size-[18px]" strokeWidth={1.5} />}
    </button>
  );

  // Brand + collapse toggle in one row (keeps the menu tall enough to fit without scrolling)
  const brandBlock = (compact: boolean, withToggle = true) =>
    compact ? (
      <div className="flex shrink-0 flex-col items-center gap-2 pb-3 pt-4">
        <Link href="/admin" aria-label={brand} className="font-display text-[24px] font-semibold text-white">
          {brand.slice(0, 1)}
        </Link>
        {withToggle && collapseBtn}
      </div>
    ) : (
      <div className="flex shrink-0 items-center gap-2 pb-3 pl-6 pr-4 pt-4">
        <Link href="/admin" aria-label={`${brand} — ${n.panelSubtitle}`} title={n.panelSubtitle} className="min-w-0 flex-1 truncate font-display text-[24px] font-semibold leading-tight tracking-[0.02em] text-white">
          {brand}
        </Link>
        {withToggle && collapseBtn}
      </div>
    );

  return (
    <>
      {/* < 1024px: top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-navy px-3 text-white lg:hidden">
        <button type="button" onClick={() => setDrawer(true)} aria-label={t.admin.openMenu} className="grid size-11 place-items-center rounded-xl hover:bg-white/10">
          <Menu className="size-6" strokeWidth={1.5} />
        </button>
        <span className="font-display text-[22px] font-semibold">{brand}</span>
      </div>

      <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col bg-navy text-white transition-[width] duration-200 lg:flex ${rail ? "w-20" : "w-[288px]"}`}>
        {brandBlock(rail)}
        <nav aria-label={t.admin.menu} className="min-h-0 flex-1 overflow-y-auto px-4">
          {rail ? railNav : expandedNav}
        </nav>
        <UserBlock user={user} logout={logout} compact={rail} />
      </aside>

      {/* Rail flyout: the group's pages to the right */}
      {rail && flyoutGroup && flyout && (
        <>
          <div className="fixed inset-0 z-40 hidden lg:block" aria-hidden onClick={() => setFlyout(null)} />
          <div
            role="menu"
            aria-label={flyoutGroup.label}
            className="fixed left-[88px] z-50 hidden w-64 rounded-2xl bg-navy p-2 text-white shadow-[0_16px_40px_rgba(14,34,67,0.35)] lg:block"
            style={{ top: Math.max(8, Math.min(flyout.top, (typeof window === "undefined" ? 800 : window.innerHeight) - 56 - flyoutGroup.children.length * 48)) }}
            onKeyDown={(e) => e.key === "Escape" && setFlyout(null)}
          >
            <p className="px-3 pb-1 pt-2 text-[13px] font-medium uppercase tracking-[0.08em] text-champagne">{flyoutGroup.label}</p>
            {flyoutGroup.children.map((c) => (
              <Leaf key={c.href} item={c} pathname={pathname} child />
            ))}
          </div>
        </>
      )}

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t.admin.menu}>
          <div className="absolute inset-0 bg-navy/40" onClick={() => setDrawer(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-[300px] max-w-[88vw] flex-col bg-navy text-white shadow-xl">
            <button type="button" onClick={() => setDrawer(false)} aria-label={t.admin.closeMenu} className="absolute right-3 top-5 grid size-11 place-items-center rounded-xl hover:bg-white/10">
              <X className="size-5" strokeWidth={1.5} />
            </button>
            {brandBlock(false, false)}
            <nav aria-label={t.admin.menu} className="flex-1 overflow-y-auto px-4">
              {expandedNav}
            </nav>
            <UserBlock user={user} logout={logout} compact={false} />
          </div>
        </div>
      )}
    </>
  );
}

function UserBlock({ user, logout, compact }: { user: Props["user"]; logout: () => Promise<void>; compact: boolean }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <div ref={ref} className="relative shrink-0 border-t border-white/10 px-3 py-1.5">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu}
        aria-label={`${n.userMenu}: ${user.name}`}
        onClick={() => setMenu(!menu)}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-1 text-left hover:bg-white/[0.06] ${compact ? "justify-center" : ""}`}
      >
        <Avatar name={user.name} id={user.id} size={32} />
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-white">{user.name}</span>
            <span className="block truncate text-[13px] text-white/60">{user.role}</span>
          </span>
        )}
      </button>
      {menu && (
        <div role="menu" className={`absolute bottom-full z-50 mb-1 rounded-2xl border border-hairline bg-white p-1.5 text-ink shadow-[0_16px_40px_rgba(14,34,67,0.18)] ${compact ? "left-3 w-56" : "inset-x-3"}`}>
          <Link role="menuitem" href="/admin/account" onClick={() => setMenu(false)} className="flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-canvas">
            <UserRound className="size-[18px] text-ink-soft" strokeWidth={1.5} aria-hidden />
            {n.account}
          </Link>
          <form action={logout}>
            <button role="menuitem" type="submit" className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] text-danger hover:bg-err-bg">
              <LogOut className="size-[18px]" strokeWidth={1.5} aria-hidden />
              {t.admin.logout}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
