"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};
const scrolledPast = () => window.scrollY > 40;

/**
 * Collection pages: header floats transparent over the banner, turns solid on scroll.
 * Whether a page has a banner is decided in CSS (`body:has([data-header-overlay])`, globals.css)
 * instead of usePathname(): reading URL data here would break regeneration of cached
 * storefront pages (e.g. a product page after its stock changes).
 *
 * `:not([style*=none])`: after client navigation Next keeps the previous page in the DOM hidden
 * (`<Activity>` → `style="display: none !important"` on the banner) — a hidden banner must not count.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const scrolled = useSyncExternalStore(subscribe, scrolledPast, () => false);
  return (
    <header data-scrolled={scrolled} className="site-header group/header sticky top-0 z-40 border-b transition-colors duration-300">
      {children}
    </header>
  );
}
