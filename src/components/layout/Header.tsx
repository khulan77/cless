import { Search, ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";
import { t } from "@/i18n";
import { BookingSheetButton } from "@/components/salon/BookingSheet";
import type { SalonContact } from "@/components/salon/ContactActions";
import type { ResolvedNavItem } from "@/server/queries/catalog";
import { BrandLogo } from "./BrandLogo";
import { HeaderShell } from "./HeaderShell";
import { headerIconCls } from "./header-icon";
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

const glyph = "size-5";

// The logo link's name starts with the wordmark text (WCAG 2.5.3); siteName stays for compatibility
export function Header({ wordmark, nav, salon, shopMode, cartCount = 0 }: Props) {
  return (
    <HeaderShell>
      {/* BR: 70px (55px on phones), 44px side padding (16px), icons 30px apart (24px), logo 141×42 (115×34) */}
      <div data-br="header.header" className="grid h-[55px] grid-cols-[1fr_auto_1fr] items-center px-4 md:h-[70px] md:px-[44px]">
        <div className="flex items-center gap-6 md:gap-[30px]">
          <MobileMenu items={nav} salon={salon} />
          <Link href="/search" aria-label={t.layout.search} data-br="header.searchIcon" className={headerIconCls}>
            <Search className={glyph} strokeWidth={1.5} aria-hidden />
          </Link>
        </div>

        <Link href="/" aria-label={t.layout.homeLink(wordmark.join(" "))} className="relative block before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']">
          <BrandLogo data-br="header.logo" className="h-[34px] w-[114.4px] md:h-[42px] md:w-[141.3px]" />
        </Link>

        <div className="flex items-center justify-end gap-6 md:gap-[30px]">
          {/* Үйлчлүүлэгчийн нэвтрэлт (PROMPT 15) — нэвтрээгүй бол /account → /login (хуудас кэштэй хэвээр) */}
          <Link href="/account" aria-label="Нэвтрэх / Миний бүртгэл" className={headerIconCls}>
            <UserRound className={glyph} strokeWidth={1.5} aria-hidden />
          </Link>
          {shopMode === "CATALOG" ? (
            <BookingSheetButton salon={salon} variant="icon" data-br="header.cartIcon" />
          ) : (
            <Link
              href="/cart"
              aria-label={cartCount > 0 ? t.layout.cartWithCount(cartCount) : t.layout.cart}
              data-br="header.cartIcon"
              className={headerIconCls}
            >
              <ShoppingBag className={glyph} strokeWidth={1.5} aria-hidden />
              {cartCount > 0 && (
                <span
                  aria-hidden
                  className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-navy px-1 text-[10px] leading-4 text-white header-cart-count"
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
