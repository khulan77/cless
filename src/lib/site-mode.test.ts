import { afterEach, describe, expect, it } from "vitest";
import { isComingSoon, isExempt, previewCookieValid, previewSecretMatches, previewToken } from "./site-mode";

afterEach(() => {
  delete process.env.SITE_MODE;
  delete process.env.SITE_PREVIEW_SECRET;
});

describe("site mode", () => {
  it("SITE_MODE=coming_soon л асаана (байхгүй / open → нээлттэй)", () => {
    expect(isComingSoon()).toBe(false);
    process.env.SITE_MODE = "open";
    expect(isComingSoon()).toBe(false);
    process.env.SITE_MODE = "coming_soon";
    expect(isComingSoon()).toBe(true);
  });

  it("чөлөөтэй замууд", () => {
    for (const p of ["/admin", "/admin/login", "/api/cron/tick", "/api/qpay/callback", "/coming-soon", "/_next/static/x.js", "/favicon.ico", "/brand/cless-logo.png"]) expect(isExempt(p), p).toBe(true);
    for (const p of ["/", "/collections/face", "/products/x", "/services", "/booking", "/account", "/login", "/search", "/cart"]) expect(isExempt(p), p).toBe(false);
  });

  it("preview: secret timing-safe; cookie нь secret биш HMAC; 16-аас богино secret идэвхгүй", () => {
    process.env.SITE_PREVIEW_SECRET = "short";
    expect(previewToken()).toBeNull();
    expect(previewSecretMatches("short")).toBe(false);
    process.env.SITE_PREVIEW_SECRET = "preview-secret-0123456789";
    expect(previewSecretMatches("preview-secret-0123456789")).toBe(true);
    expect(previewSecretMatches("preview-secret-012345678X")).toBe(false);
    const t = previewToken()!;
    expect(t).not.toContain("preview-secret");
    expect(previewCookieValid(t)).toBe(true);
    expect(previewCookieValid("forged")).toBe(false);
    process.env.SITE_PREVIEW_SECRET = "rotated-secret-0123456789";
    expect(previewCookieValid(t)).toBe(false);
  });
});
