import { Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { t } from "@/i18n";
import { BookingSheetButton } from "@/components/salon/BookingSheet";
import type { SalonContact } from "@/components/salon/ContactActions";
import type { ResolvedNavItem } from "@/server/queries/catalog";
import { HeaderShell } from "./HeaderShell";
import { MobileMenu } from "./MobileMenu";

type Props = {
  wordmark: string[];
  siteName: string;
  nav: ResolvedNavItem[];
  salon: SalonContact;
  /** CATALOG: no cart — the booking sheet takes its place */
  shopMode: "CATALOG" | "CHECKOUT";
  /** TODO (checkout phase): real cart count */
  cartCount?: number;
};

const iconCls = "size-[22px]";

// siteName: лого линкийн нэр харагдах wordmark-аар эхэлнэ (WCAG 2.5.3); prop нь нийцтэй байдлын үүднээс үлдэв
export function Header({ wordmark, nav, salon, shopMode, cartCount = 0 }: Props) {
  return (
    <HeaderShell>
      <div className="mx-auto grid h-16 max-w-[1376px] grid-cols-[1fr_auto_1fr] items-center px-2 md:h-[76px] md:px-10">
        <div className="flex items-center gap-1">
          <MobileMenu items={nav} salon={salon} />
          <Link href="/search" aria-label={t.layout.search} className="grid size-11 place-items-center">
            <Search className={iconCls} strokeWidth={1.25} aria-hidden />
          </Link>
        </div>

        {/* TODO: replace with the official SVG logo */}
        <Link href="/" aria-label={t.layout.homeLink(wordmark.join(" "))} className="flex min-h-11 flex-col items-center justify-center font-serif leading-none">
          {wordmark.map((line, i) => (
            <span
              key={line}
              className={
                i === wordmark.length - 1
                  ? "mt-1 text-[8px] tracking-[0.5em] md:text-[9px]"
                  : "text-[14px] tracking-[0.32em] md:text-[17px]"
              }
            >
              {line}{" "}
            </span>
          ))}
        </Link>

        <div className="flex items-center justify-end gap-1">
          {shopMode === "CATALOG" ? (
            <BookingSheetButton salon={salon} variant="icon" />
          ) : (
            <Link
              href="/cart"
              aria-label={cartCount > 0 ? t.layout.cartWithCount(cartCount) : t.layout.cart}
              className="relative grid size-11 place-items-center"
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
          )}
        </div>
      </div>
    </HeaderShell>
  );
}
