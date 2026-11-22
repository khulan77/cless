"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};
const scrolledPast = () => window.scrollY > 40;

/** Collection pages: header floats transparent over the banner, turns solid on scroll. */
export function HeaderShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const overlay = /^\/collections\/[^/]+$/.test(pathname);
  const scrolled = useSyncExternalStore(subscribe, scrolledPast, () => false);
  const transparent = overlay && !scrolled;

  return (
    <header
      data-transparent={transparent}
      className={`group/header sticky top-0 z-40 border-b transition-colors duration-300 ${
        transparent ? "on-dark border-transparent bg-transparent text-white" : "border-line bg-white text-navy"
      }`}
    >
      {children}
    </header>
  );
}
