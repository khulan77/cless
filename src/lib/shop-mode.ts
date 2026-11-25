/** Paths that only make sense with online checkout (hidden in CATALOG mode) */
const CHECKOUT_ONLY = [/^\/cart(\/|$)/, /^\/checkout(\/|$)/, /^\/shipping(\/|$)/, /^\/gift-?cards?(\/|$)/];

export function isCheckoutOnlyHref(href: string): boolean {
  return CHECKOUT_ONLY.some((re) => re.test(href));
}
