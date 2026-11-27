import { spawn, type ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import { e2eEnv } from "./env";

/**
 * PROMPT 24: SITE_MODE=coming_soon — тусдаа порт дээр ижил build-ийг өөр env-тэй асаана.
 */
test.describe.configure({ mode: "serial" });

const PORT = 20291;
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = "e2e-preview-secret-0123456789";
let server: ChildProcess;

test.beforeAll(async () => {
  server = spawn("bunx", ["next", "start", "--port", String(PORT)], {
    env: { ...e2eEnv(), SITE_MODE: "coming_soon", SITE_PREVIEW_SECRET: SECRET, NEXT_PUBLIC_SITE_URL: BASE, APP_INTERNAL_URL: BASE },
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/admin/login`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("coming-soon server did not start");
});
test.afterAll(() => {
  server?.kill();
});

test("public pages → 503 «Удахгүй нээгдэнэ» (URL хэвээр), admin / api чөлөөтэй, robots Disallow", async ({ request }) => {
  for (const path of ["/", "/products/serum-biofixine", "/services", "/login"]) {
    const r = await request.get(`${BASE}${path}`, { maxRedirects: 0 });
    expect(r.status(), path).toBe(503);
    expect(r.headers()["retry-after"]).toBe("86400");
    expect(r.headers()["x-robots-tag"]).toContain("noindex");
    expect(await r.text()).toContain("Удахгүй нээгдэнэ");
  }
  expect((await request.get(`${BASE}/admin/login`)).status()).toBe(200);
  expect((await request.post(`${BASE}/api/cron/tick`)).status()).toBe(401); // өөрчлөгдөөгүй — CRON_SECRET-ээр
  expect(await (await request.get(`${BASE}/robots.txt`)).text()).toContain("Disallow: /");
  expect(await (await request.get(`${BASE}/sitemap.xml`)).text()).not.toContain("<url>");
});

test("?preview=<secret> → cookie → жинхэнэ нүүр (noindex); буруу secret → cookie үгүй; ?preview=off → дахин 503", async ({ request }) => {
  const bad = await request.get(`${BASE}/?preview=wrong`, { maxRedirects: 0 });
  expect(bad.headers()["set-cookie"] ?? "").not.toContain("cless_preview");

  const ok = await request.get(`${BASE}/?preview=${SECRET}`, { maxRedirects: 0 });
  expect(ok.status()).toBe(307);
  const cookie = /cless_preview=([^;]+)/.exec(ok.headers()["set-cookie"] ?? "")![1]!;
  expect(ok.headers()["set-cookie"]).toMatch(/HttpOnly/i);
  expect(cookie).not.toContain(SECRET);

  const real = await request.get(`${BASE}/`, { headers: { cookie: `cless_preview=${cookie}` } });
  expect(real.status()).toBe(200);
  expect(real.headers()["x-robots-tag"]).toContain("noindex");
  expect(await real.text()).not.toContain("Удахгүй нээгдэнэ");

  const off = await request.get(`${BASE}/?preview=off`, { maxRedirects: 0, headers: { cookie: `cless_preview=${cookie}` } });
  expect(off.headers()["set-cookie"]).toMatch(/cless_preview=;/);
});
