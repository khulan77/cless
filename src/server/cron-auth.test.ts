import { afterEach, describe, expect, it } from "vitest";
import { cronAuthorized } from "./cron-auth";

const req = (auth?: string) => new Request("http://x/api/cron/attendance", { headers: auth ? { authorization: auth } : {} });

describe("cronAuthorized", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });
  it("CRON_SECRET-гүй бол хэзээ ч үгүй", () => {
    expect(cronAuthorized(req("Bearer "))).toBe(false);
  });
  it("зөв Bearer л", () => {
    process.env.CRON_SECRET = "s".repeat(32);
    expect(cronAuthorized(req(`Bearer ${"s".repeat(32)}`))).toBe(true);
    expect(cronAuthorized(req(`Bearer ${"x".repeat(32)}`))).toBe(false);
    expect(cronAuthorized(req())).toBe(false);
  });
});
