"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { t } from "@/i18n";
import type { ResolvedNavItem } from "@/server/queries/catalog";
import { MegaMenu } from "./MegaMenu";

/**
 * Hamburger + left drawer on every breakpoint. On desktop the sub-menu (MegaMenu)
 * opens as a second column; on mobile it replaces the drawer with a back button.
 */
export function MobileMenu({ items }: { items: ResolvedNavItem[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setActive(null);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setActive(null);
        triggerRef.current?.focus();
      }
      // Simple focus trap
      if (e.key === "Tab" && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>("a, button");
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeItem = active !== null ? items[active] : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t.layout.openMenu}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center"
      >
        <Menu className="size-[22px]" strokeWidth={1.25} aria-hidden />
      </button>

      <div
        className={`fixed inset-0 z-50 bg-navy/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={close}
        aria-hidden
      />

      <div
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.layout.mainMenu}
        // Closed drawer: not reachable by Tab and hidden from screen readers
        inert={!open}
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-50 flex max-w-full transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav
          aria-label={t.layout.mainNav}
          className={`h-full w-screen overflow-y-auto bg-white px-6 pb-10 pt-4 text-navy sm:w-[380px] ${
            activeItem ? "max-md:hidden" : ""
          }`}
        >
          <div className="mb-6 flex justify-end">
            <button type="button" onClick={close} aria-label={t.layout.closeMenu} className="grid size-10 place-items-center">
              <X className="size-[22px]" strokeWidth={1.25} aria-hidden />
            </button>
          </div>
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={item.label}>
                {item.groups.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setActive(active === i ? null : i)}
                    aria-expanded={active === i}
                    className={`flex w-full items-center justify-between py-3 text-left text-[15px] uppercase tracking-[0.6px] ${
                      active === i ? "underline underline-offset-4" : ""
                    }`}
                  >
                    {item.label}
                    <span aria-hidden className="text-muted">
                      ›
                    </span>
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    onClick={close}
                    className="block py-3 text-[15px] uppercase tracking-[0.6px]"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {activeItem && <MegaMenu item={activeItem} onBack={() => setActive(null)} onNavigate={close} />}
      </div>
    </>
  );
}
