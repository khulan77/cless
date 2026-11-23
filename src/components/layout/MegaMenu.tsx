"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { t } from "@/i18n";
import type { ResolvedNavItem } from "@/server/queries/catalog";

type Props = {
  item: ResolvedNavItem;
  onBack: () => void;
  onNavigate: () => void;
};

/** Sub-menu: groups built from collections */
export function MegaMenu({ item, onBack, onNavigate }: Props) {
  return (
    <section
      aria-label={item.label}
      className="h-full w-screen overflow-y-auto border-l border-line bg-white px-6 pb-10 pt-4 text-navy sm:w-[380px] md:w-[420px] md:bg-promo"
    >
      <div className="mb-6 flex h-10 items-center md:hidden">
        <button type="button" onClick={onBack} className="-ml-2 flex items-center gap-1 py-2 text-button">
          <ChevronLeft className="size-4" strokeWidth={1.25} aria-hidden />
          {t.layout.back}
        </button>
      </div>
      <div className="mb-8 hidden h-10 md:block" aria-hidden />

      <p className="text-micro mb-6 text-muted">{item.label}</p>

      <div className="space-y-8">
        {item.groups.map((g) => (
          <div key={g.title}>
            <h3 className="text-micro mb-3">{g.title}</h3>
            <ul className="space-y-0.5">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={onNavigate} className="block py-1.5 text-body hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Link href={item.href} onClick={onNavigate} className="link-underline inline-block text-button">
          {t.common.viewAll}
        </Link>
      </div>
    </section>
  );
}
