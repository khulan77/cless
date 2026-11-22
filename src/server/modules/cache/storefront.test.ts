import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag }));
const { POST } = await import("@/app/api/internal/revalidate/route");
const { requestStorefrontRevalidate, INTERNAL_SECRET_HEADER } = await import("./storefront");

const SECRET = "internal-secret-for-tests-0123456789";
const req = (headers: Record<string, string>, body: unknown = { tags: ["catalog"] }) =>
  new Request("http://127.0.0.1:20267/api/internal/revalidate", { method: "POST", headers, body: JSON.stringify(body) }) as never;

beforeEach(() => {
  process.env.INTERNAL_REVALIDATE_SECRET = SECRET;
  revalidateTag.mockClear();
});
afterEach(() => {
  delete process.env.INTERNAL_REVALIDATE_SECRET;
});

describe("internal revalidate route", () => {
  it("rejects a missing / wrong secret", async () => {
    expect((await POST(req({}))).status).toBe(404);
    expect((await POST(req({ [INTERNAL_SECRET_HEADER]: "nope" }))).status).toBe(404);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects requests that came through the reverse proxy even with the right secret", async () => {
    expect((await POST(req({ [INTERNAL_SECRET_HEADER]: SECRET, "x-forwarded-for": "1.2.3.4" }))).status).toBe(404);
    // Хуурамч дотоод хаяг + Caddy-ийн нэмсэн жинхэнэ IP
    expect((await POST(req({ [INTERNAL_SECRET_HEADER]: SECRET, "x-forwarded-for": "127.0.0.1, 203.0.113.5" }))).status).toBe(404);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("accepts internal addresses that Next/Docker add to X-Forwarded-For", async () => {
    for (const xff of ["::1", "::ffff:127.0.0.1", "172.18.0.3", "10.0.0.5, 192.168.1.2"]) {
      expect((await POST(req({ [INTERNAL_SECRET_HEADER]: SECRET, "x-forwarded-for": xff }))).status).toBe(200);
    }
    expect((await POST(req({ [INTERNAL_SECRET_HEADER]: SECRET, "x-forwarded-for": "172.32.0.1" }))).status).toBe(404);
  });

  it("expires only allowed storefront tags immediately", async () => {
    const res = await POST(req({ [INTERNAL_SECRET_HEADER]: SECRET }, { tags: ["catalog", "settings", 1] }));
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith("catalog", { expire: 0 });
  });
});

describe("worker → requestStorefrontRevalidate", () => {
  it("posts the secret to APP_INTERNAL_URL and survives failures", async () => {
    process.env.APP_INTERNAL_URL = "http://app:20267/";
    const ok = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await requestStorefrontRevalidate("stale-unlock", ok as unknown as typeof fetch)).toBe(true);
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://app:20267/api/internal/revalidate");
    expect((init.headers as Record<string, string>)[INTERNAL_SECRET_HEADER]).toBe(SECRET);

    const down = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await requestStorefrontRevalidate("x", down as unknown as typeof fetch)).toBe(false);
    delete process.env.APP_INTERNAL_URL;
  });
});
