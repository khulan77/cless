import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { imageFileError } from "@/lib/upload-limits";
import { setStorageFetchForTests, supabaseStorage } from "./supabase";

type Call = { url: string; method: string; headers: Headers; body: unknown };
let calls: Call[] = [];
let status = 200;

beforeEach(() => {
  process.env.SUPABASE_URL = "https://abc.supabase.co/";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  calls = [];
  status = 200;
  setStorageFetchForTests(
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? "GET", headers: new Headers(init?.headers), body: init?.body });
      return new Response(status === 200 ? "{}" : '{"message":"Bucket not found"}', { status });
    }) as unknown as typeof fetch,
  );
});
afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  setStorageFetchForTests(undefined);
  vi.restoreAllMocks();
});

const png = () => new File([new Uint8Array([137, 80, 78, 71])], "a.png", { type: "image/png" });

describe("Supabase storage", () => {
  it("uploads to the bucket and returns the public URL", async () => {
    const { url } = await supabaseStorage.put(png(), "products");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toMatch(/^https:\/\/abc\.supabase\.co\/storage\/v1\/object\/media\/products\/\d+-[0-9a-f]{8}\.png$/);
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer service-role-test");
    expect(calls[0]!.headers.get("content-type")).toBe("image/png");
    expect(url).toMatch(/^https:\/\/abc\.supabase\.co\/storage\/v1\/object\/public\/media\/products\/\d+-[0-9a-f]{8}\.png$/);
  });

  it("an error does not leak the key", async () => {
    status = 400;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(supabaseStorage.put(png(), "products")).rejects.toThrow(/storage 400/);
    expect(JSON.stringify(log.mock.calls)).not.toContain("service-role-test");
  });

  it("removes only its own bucket's objects", async () => {
    await supabaseStorage.remove("/images/demo.webp");
    await supabaseStorage.remove("https://other.example/x.png");
    expect(calls).toHaveLength(0);
    await supabaseStorage.remove("https://abc.supabase.co/storage/v1/object/public/media/products/1-abcdef12.webp");
    expect(calls[0]).toMatchObject({ method: "DELETE", url: "https://abc.supabase.co/storage/v1/object/media", body: JSON.stringify({ prefixes: ["products/1-abcdef12.webp"] }) });
  });
});

describe("upload limits", () => {
  it.each([
    [{ name: "a.gif", type: "image/gif", size: 10 }, /зөвхөн JPG, PNG, WEBP, AVIF/],
    [{ name: "big.jpg", type: "image/jpeg", size: 4.2 * 1024 * 1024 }, /4\.2MB байна\. 4MB-аас ихгүй/],
  ])("%o", (f, msg) => expect(imageFileError(f)).toMatch(msg));
  it("ok", () => expect(imageFileError({ name: "a.webp", type: "image/webp", size: 1000 })).toBeNull());
});
