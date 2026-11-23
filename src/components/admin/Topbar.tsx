"use client";

import { Bell, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n";
import { Avatar } from "./ui";
import { isGroup, type NavEntry, type NavLeaf } from "./nav";

const n = t.admin.nav;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Sticky page bar: "Удирдлага / Касс / Борлуулалт" on the left, role + avatar on the right */
export type Notice = { key: string; label: string; count: number; href: string };

export function Topbar({ entries, user, notices }: { entries: NavEntry[]; user: { name: string; id: string; role: string }; notices: Notice[] }) {
  const pathname = usePathname();
  let group: string | null = null;
  let leaf: NavLeaf | undefined;
  for (const e of entries) {
    if (isGroup(e)) {
      const hit = e.children.filter((c) => isActive(pathname, c.href)).sort((a, b) => b.href.length - a.href.length)[0];
      if (hit) {
        group = e.label;
        leaf = hit;
      }
    } else if (isActive(pathname, e.href) && (!leaf || e.href.length > leaf.href.length)) {
      group = null;
      leaf = e;
    }
  }
  const deeper = leaf && pathname !== leaf.href;
  const crumbs: { label: string; href?: string }[] = [{ label: n.home, href: "/admin" }];
  if (group) crumbs.push({ label: group });
  if (leaf && leaf.href !== "/admin") crumbs.push({ label: leaf.label, href: deeper ? leaf.href : undefined });

  return (
    <header className="sticky top-0 z-20 hidden h-16 shrink-0 items-center gap-4 border-b border-hairline bg-canvas/85 px-10 backdrop-blur lg:flex">
      <nav aria-label="Байршил" className="min-w-0 flex-1">
        <ol className="flex items-center gap-2.5 text-[14px]">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-2.5">
                {i > 0 && <span aria-hidden className="text-ink-faint">/</span>}
                {c.href && !last ? (
                  <Link href={c.href} className="truncate text-ink-soft hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={`truncate ${last ? "font-medium text-ink" : "text-ink-soft"}`}>
                    {c.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {notices.length > 0 && <BellMenu notices={notices} />}
      <span className="rounded-full bg-champagne/15 px-3 py-1 text-[13px] font-medium text-[#6f5733]">{user.role}</span>
      <Link href="/admin/account" aria-label={n.account} title={user.name} className="rounded-full ring-offset-2 hover:ring-2 hover:ring-hairline">
        <Avatar name={user.name} id={user.id} size={36} />
      </Link>
    </header>
  );
}

const b = t.admin.bell;

/** Bell with a dot when something is waiting; the list links to the page that handles it */
function BellMenu({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const total = notices.reduce((s, x) => s + x.count, 0);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={total > 0 ? b.labelWithCount(total) : b.label}
        title={b.label}
        onClick={() => setOpen(!open)}
        className="relative grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-ink/[0.05] hover:text-ink"
      >
        <Bell className="size-5" strokeWidth={1.75} aria-hidden />
        {total > 0 && <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-canvas" />}
      </button>
      {open && (
        <div role="menu" aria-label={b.title} className="absolute right-0 top-full z-40 mt-2 w-80 rounded-2xl border border-hairline bg-white p-1.5 shadow-[0_16px_40px_rgba(14,34,67,0.14)]">
          <p className="px-3 pb-1 pt-2 text-[13px] font-medium text-ink-soft">{b.title}</p>
          {notices.map((x) => (
            <Link
              key={x.key}
              role="menuitem"
              href={x.href}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[14px] hover:bg-canvas ${x.count > 0 ? "text-ink" : "text-ink-soft"}`}
            >
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${x.count > 0 ? (x.key === "emails" ? "bg-danger" : "bg-champagne") : "bg-ink/15"}`} />
              <span className="flex-1">{x.label}</span>
              <ChevronRight className="size-4 text-ink-faint" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
