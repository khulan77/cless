import { describe, expect, it } from "vitest";
import { checkEnv } from "./env";

const base = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u@db:5432/cless",
  AUTH_SECRET: "x".repeat(32),
  NEXT_PUBLIC_SITE_URL: "https://cless.mn",
  RESEND_API_KEY: "re_123",
  EMAIL_FROM: "CLÉSS <no-reply@cless.mn>",
  INTERNAL_REVALIDATE_SECRET: "y".repeat(32),
  APP_INTERNAL_URL: "http://app:20267",
};
const keys = (env: Record<string, string | undefined>, target: "app" | "worker" = "app") => checkEnv(env, target).issues.map((i) => i.key);

describe("env check", () => {
  it("a complete production env passes", () => {
    expect(keys(base)).toEqual([]);
    expect(keys(base, "worker")).toEqual([]);
  });

  it("production: WeSend required unless the legacy Resend e-mail is set (then only a warning)", () => {
    const noMail = { ...base, RESEND_API_KEY: "", EMAIL_FROM: "" };
    expect(keys(noMail)).toEqual(["WESEND_API_KEY"]);
    expect(keys({ ...noMail, WESEND_API_KEY: "ws_" + "x".repeat(48) })).toEqual([]);
    expect(checkEnv(base, "app").warnings.map((w) => w.key)).toContain("WESEND_API_KEY");
  });

  it("production: required values, https site URL, 32+ char secrets", () => {
    expect(keys({ ...base, DATABASE_URL: undefined })).toEqual(["DATABASE_URL"]);
    expect(keys({ ...base, DATABASE_URL: "mysql://x" })).toEqual(["DATABASE_URL"]);
    expect(keys({ ...base, AUTH_SECRET: "short" })).toEqual(["AUTH_SECRET"]);
    expect(keys({ ...base, NEXT_PUBLIC_SITE_URL: "http://cless.mn" })).toEqual(["NEXT_PUBLIC_SITE_URL"]);
    expect(keys({ ...base, INTERNAL_REVALIDATE_SECRET: undefined })).toEqual(["INTERNAL_REVALIDATE_SECRET"]);
    expect(keys({ ...base, APP_INTERNAL_URL: undefined }, "worker")).toEqual(["APP_INTERNAL_URL"]);
  });

  it("QPay: partial configuration is an error, full configuration is fine", () => {
    const partial = { ...base, QPAY_BASE_URL: "https://merchant.qpay.mn", QPAY_USERNAME: "u" };
    expect(keys(partial).sort()).toEqual(["QPAY_CALLBACK_SECRET", "QPAY_INVOICE_CODE", "QPAY_PASSWORD"]);
    const full = { ...partial, QPAY_PASSWORD: "p", QPAY_INVOICE_CODE: "C", QPAY_CALLBACK_SECRET: "z".repeat(32) };
    expect(keys(full)).toEqual([]);
    expect(keys({ ...full, QPAY_BASE_URL: "http://merchant.qpay.mn" })).toEqual(["QPAY_BASE_URL"]);
  });

  it("development only warns; ENV_CHECK=relaxed allows a local http production build", () => {
    const dev = { NODE_ENV: "development", DATABASE_URL: base.DATABASE_URL, AUTH_SECRET: "short-dev-secret" };
    expect(keys(dev)).toEqual([]);
    expect(checkEnv(dev, "app").warnings.map((w) => w.key)).toContain("AUTH_SECRET");
    const local = { ...base, ENV_CHECK: "relaxed", NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:20268", RESEND_API_KEY: "", EMAIL_FROM: "" };
    expect(keys(local)).toEqual([]);
  });
});
