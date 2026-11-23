
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page } from "@playwright/test";

const URL = "https://www.biologique-recherche.com/fr-fr";
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
  { name: "390", width: 390, height: 844, mobile: true },
] as const;

/** name → CSS selector (first match). Sections are located by their Shopify section id suffix. */
export const TARGETS: Record<string, string> = {
  // Announcement bar
  "announcement.bar": ".announcement-bar",
  "announcement.inner": ".announcement-bar .page-width",
  "announcement.text": ".announcement-slider__slide.is-selected .announcement-text",
  "announcement.prev": ".announcement__button--prev",
  "announcement.prevIcon": ".announcement__button--prev svg",
  "announcement.next": ".announcement__button--next",
  // Header
  "header.wrapper": "sticky-header",
  "header.header": "header.header",
  "header.menuIcon": ".header__icon--menu",
  "header.menuSvg": ".header__icon--menu svg.icon-hamburger",
  "header.searchIcon": ".header__icon--search",
  "header.searchSvg": ".header__icon--search svg",
  "header.logo": ".header__heading-logo.normal, .header__heading-link img",
  "header.right": ".header__right",
  "header.accountIcon": ".header__icon--account",
  "header.cartIcon": ".header__icon--cart",
  // Hero (first slideshow)
  "hero.section": "main section:first-of-type",
  "hero.slide": "main section:first-of-type .swiper-slide-active, main section:first-of-type .slideshow__slide",
  "hero.box": "main section:first-of-type .slideshow__box",
  "hero.title": "main section:first-of-type .slideshow__heading",
  "hero.link": "main section:first-of-type .slideshow__link a",
  // Promo 3 cards (multicolumn)
  "promo.section": "[id*='multicolumn'] .section--padding, [id*='multicolumn'] > div",
  "promo.pageWidth": "[id*='multicolumn'] .multicolumn.page-width",
  "promo.list": "[id*='multicolumn'] .multicolumn-list",
  "promo.card": "[id*='multicolumn'] .multicolumn-card",
  "promo.image": "[id*='multicolumn'] .multicolumn-card__image-wrapper",
  "promo.title": "[id*='multicolumn'] .multicolumn-card__title",
  "promo.text": "[id*='multicolumn'] .multicolumn-card__info .rte p",
  "promo.button": "[id*='multicolumn'] .multicolumn-card__info .button",
  // Banner under the promo cards (image with text — our SplitPromo)
  "banner.grid": "[id*='image_with_text_seo'] .image-with-text",
  "banner.image": "[id*='image_with_text_seo'] .media-wrapper",
  "banner.content": "[id*='image_with_text_seo'] .image-with-text__content",
  "banner.eyebrow": "[id*='image_with_text_seo'] .image-with-text__subheading",
  "banner.title": "[id*='image_with_text_seo'] .image-with-text__heading",
  "banner.text": "[id*='image_with_text_seo'] .image-with-text__text p",
  "banner.link": "[id*='image_with_text_seo'] .link",
  // Featured product (shop the look — our FeaturedProduct)
  "featured.section": "[id*='shop_the_look'] .section--padding",
  "featured.title": "[id*='shop_the_look'] .title",
  "featured.grid": "[id*='shop_the_look'] .image-with-text__grid",
  "featured.image": "[id*='shop_the_look'] .shop-the-look__content",
  "featured.content": "[id*='shop_the_look'] .image-with-text__content",
  "featured.card": "[id*='shop_the_look'] .card-wrapper",
  // Product card (featured collection)
  "products.section": "[id*='featured_collection'] .section--padding",
  "products.title": "[id*='featured_collection'] .title",
  "products.grid": "[id*='featured_collection'] .product-grid",
  "card.wrapper": "[id*='featured_collection'] .card-wrapper",
  "card.media": "[id*='featured_collection'] .card__media",
  "card.info": "[id*='featured_collection'] .card-information",
  "card.name": "[id*='featured_collection'] .card-information .card__heading, [id*='featured_collection'] .card-information a, [id*='featured_collection'] .card-information__wrapper > *",
  "card.badge": "[id*='featured_collection'] .product__label",
  "card.price": "[id*='featured_collection'] .price",
  "card.priceText": "[id*='featured_collection'] .price dd, [id*='featured_collection'] .price .price-item",
  "card.addToCart": "[id*='featured_collection'] .add-to-cart__button",
  // Guarantees row
  "guarantees.section": ".guarantees",
  "guarantees.list": ".guarantees ul.grid",
  "guarantees.item": ".guarantees .guarantee__item",
  "guarantees.icon": ".guarantees .guarantee__icon",
  "guarantees.text": ".guarantees .guarantee__text p",
  // Footer
  "footer.footer": "footer.footer",
  "footer.top": ".footer__content-top",
  "footer.blocks": ".footer__blocks-wrapper",
  "footer.column": ".footer-block",
  "footer.title": ".footer-block .accordion__title",
  "footer.list": ".footer-block__details-content",
  "footer.item": ".footer-block__details-content li",
  "footer.link": ".footer-block__details-content a",
  "footer.social": ".footer__list-social",
  "footer.socialItem": ".footer__list-social li",
  "footer.socialIcon": ".footer__list-social svg",
  "footer.bottom": ".footer__content-bottom",
  "footer.bottomWrapper": ".footer__content-bottom-wrapper",
  "footer.copyright": ".footer__copyright",
  "footer.legal": ".footer__column--extra",
  "footer.legalLink": ".footer__column--extra a, .policies a",
  // Layout
  "layout.pageWidth": "main .page-width:not(.page-width--full-width)",
  "layout.main": "main",
};

const STYLE_KEYS = [
  "fontFamily", "fontSize", "lineHeight", "fontWeight", "letterSpacing", "textTransform", "color",
  "backgroundColor", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "marginTop", "marginBottom", "rowGap", "columnGap", "borderRadius", "borderTop", "borderBottom",
  "position", "display", "gridTemplateColumns", "objectFit", "aspectRatio",
] as const;

export type Measured = {
  selector: string;
  count: number;
  rect: { x: number; y: number; width: number; height: number } | null;
  text?: string;
  styles?: Record<string, string>;
};

async function hideBanners(page: Page) {
  await page.addStyleTag({
    content: `#onetrust-consent-sdk, #onetrust-banner-sdk, [id*="didomi"], [id*="axeptio"], .cookie-banner,
      #shopify-pc__banner { display: none !important; }`,
  });
}

/** Footer newsletter: a Klaviyo form that renders only once the footer is in view — second pass */
export const NEWSLETTER_TARGETS: Record<string, string> = {
  "footer.newsletterBlock": ".footer__blocks-wrapper > .shopify-app-block",
  "footer.newsletterForm": ".footer .klaviyo-form form",
  "footer.newsletterTitle": ".footer .klaviyo-form form [role='heading'], .footer .klaviyo-form form h2, .footer .klaviyo-form form p:first-of-type",
  "footer.newsletterText": ".footer .klaviyo-form form p:nth-of-type(2), .footer .klaviyo-form form div > p",
  "footer.newsletterInput": ".footer .klaviyo-form input[type='email']",
  "footer.newsletterButton": ".footer .klaviyo-form button",
};

export async function measure(page: Page, targets: Record<string, string> = TARGETS): Promise<Record<string, Measured>> {
  return page.evaluate(
    ([targets, keys]) => {
      const out: Record<string, unknown> = {};
      for (const [name, sel] of Object.entries(targets)) {
        let els: Element[] = [];
        try {
          els = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0);
        } catch {
          /* invalid selector in this browser */
        }
        const el = els[0];
        if (!el) {
          out[name] = { selector: sel, count: 0, rect: null };
          continue;
        }
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const styles: Record<string, string> = {};
        for (const k of keys) styles[k] = cs[k as keyof CSSStyleDeclaration] as string;
        out[name] = {
          selector: sel,
          count: els.length,
          rect: { x: Math.round(r.x * 10) / 10, y: Math.round((r.y + scrollY) * 10) / 10, width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 },
          text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
          styles,
        };
      }
      return out as Record<string, Measured>;
    },
    [targets, STYLE_KEYS] as const,
  );
}

/** Scroll through the page so lazy sections render, then back to the top */
export async function settle(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
}

if (import.meta.main) {
  const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH || undefined });
  const result: Record<string, unknown> = { url: URL, measuredAt: new Date().toISOString(), viewports: {} };
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: "mobile" in vp ? 2 : 1,
      isMobile: "mobile" in vp,
      hasTouch: "mobile" in vp,
      locale: "fr-FR",
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3000);
    await hideBanners(page);
    await settle(page);
    const data = await measure(page);
    await page.evaluate(() => document.querySelector("footer")?.scrollIntoView());
    await page.waitForTimeout(3000);
    Object.assign(data, await measure(page, NEWSLETTER_TARGETS));
    const missing = Object.entries(data).filter(([, v]) => !v.rect).map(([k]) => k);
    console.log(`${vp.name}: ${Object.keys(data).length - missing.length}/${Object.keys(data).length} found${missing.length ? ` — missing: ${missing.join(", ")}` : ""}`);
    (result.viewports as Record<string, unknown>)[vp.name] = { width: vp.width, height: vp.height, elements: data };
    await ctx.close();
  }
  await browser.close();
  await mkdir("docs", { recursive: true });
  await writeFile("docs/br-measurements.json", JSON.stringify(result, null, 2) + "\n");
  console.log("→ docs/br-measurements.json");
}
