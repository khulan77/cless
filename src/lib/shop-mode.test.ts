import { describe, expect, it } from "vitest";
import { isPlaceholderSrc, realImageSrc } from "./placeholder";
import { isCheckoutOnlyHref } from "./shop-mode";

describe("CATALOG mode hides checkout-only links", () => {
  it.each(["/cart", "/checkout", "/checkout/pay", "/shipping", "/gift-cards", "/giftcard"])("%s → hidden", (h) =>
    expect(isCheckoutOnlyHref(h)).toBe(true),
  );
  it.each(["/collections/gifts", "/collections", "/services", "/salon", "/cartier", "/account", "/booking"])("%s → kept", (h) => expect(isCheckoutOnlyHref(h)).toBe(false));
});

describe("placeholders", () => {
  it("recognises dev placeholders", () => {
    expect(isPlaceholderSrc("/placeholders/hero.svg")).toBe(true);
    expect(isPlaceholderSrc("/uploads/hero.jpg")).toBe(false);
  });
  it("slots with text on top never use them; real images pass", () => {
    expect(realImageSrc("/placeholders/hero.svg", { always: true })).toBeNull();
    expect(realImageSrc("/uploads/a.jpg", { always: true })).toBe("/uploads/a.jpg");
    expect(realImageSrc(null)).toBeNull();
  });
});
