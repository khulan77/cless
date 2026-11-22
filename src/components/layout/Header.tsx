import { Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { t } from "@/i18n";
import type { ResolvedNavItem } from "@/server/queries/catalog";
import { HeaderShell } from "./HeaderShell";
import { MobileMenu } from "./MobileMenu";

type Props = {
  wordmark: string[];
  siteName: string;
  nav: ResolvedNavItem[];
  /** TODO (cart round): real cart count */
  cartCount?: number;
};

const iconCls = "size-[22px]";

export function Header({ wordmark, siteName, nav, cartCount = 0 }: Props) {
  return (
    <HeaderShell>
      <div className="mx-auto grid h-16 max-w-[1376px] grid-cols-[1fr_auto_1fr] items-center px-2 md:h-[76px] md:px-10">
        <div className="flex items-center gap-1">
          <MobileMenu items={nav} />
          <Link href="/search" aria-label={t.layout.search} className="grid size-10 place-items-center">
            <Search className={iconCls} strokeWidth={1.25} aria-hidden />
          </Link>
        </div>

        {/* TODO: replace with the official SVG logo */}
        <Link href="/" aria-label={t.layout.homeLink(siteName)} className="flex flex-col items-center font-serif leading-none">
          {wordmark.map((line, i) => (
            <span
              key={line}
              className={
                i === wordmark.length - 1
                  ? "mt-1 text-[8px] tracking-[0.5em] md:text-[9px]"
                  : "text-[14px] tracking-[0.32em] md:text-[17px]"
              }
            >
              {line}
            </span>
          ))}
        </Link>

        <div className="flex items-center justify-end gap-1">
          <Link href="/account" aria-label={t.layout.account} className="grid size-10 place-items-center">
            <User className={iconCls} strokeWidth={1.25} aria-hidden />
          </Link>
          <Link
            href="/cart"
            aria-label={cartCount > 0 ? t.layout.cartWithCount(cartCount) : t.layout.cart}
            className="relative grid size-10 place-items-center"
          >
            <ShoppingBag className={iconCls} strokeWidth={1.25} aria-hidden />
            {cartCount > 0 && (
              <span
                aria-hidden
                className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-navy px-1 text-[10px] leading-4 text-white header-cart-count"
              >
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </HeaderShell>
  );
}
