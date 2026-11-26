import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateStorage, setPrivateStorageFetchForTests } from "./private";

type Call = { url: string; method: string; headers: Headers };
let calls: Call[] = [];
let respond: (c: Call) => Response = () => new Response("{}", { status: 200 });

beforeEach(() => {
  process.env.SUPABASE_URL = "https://abc.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  calls = [];
  respond = () => new Response("{}", { status: 200 });
  setPrivateStorageFetchForTests(async (url, init) => {
    const c = { url, method: init?.method ?? "GET", headers: new Headers(init?.headers) };
    calls.push(c);
    return respond(c);
  });
});
afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_PRIVATE_BUCKET;
  setPrivateStorageFetchForTests(undefined);
  vi.restoreAllMocks();
});

describe("private Supabase storage", () => {
  it("put → private bucket path (no public URL); read → authenticated endpoint; remove", async () => {
    await privateStorage.put("visits/cv1/abc-123.webp", Buffer.from("img"));
    expect(calls[0]).toMatchObject({ method: "POST", url: "https://abc.supabase.co/storage/v1/object/visit-photos/visits/cv1/abc-123.webp" });
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer service-role-test");
    expect(calls[0]!.headers.get("content-type")).toBe("image/webp");

    respond = () => new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    expect(await privateStorage.read("visits/cv1/abc-123.webp")).toEqual(Buffer.from([1, 2, 3]));
    expect(calls[1]!.url).toBe("https://abc.supabase.co/storage/v1/object/authenticated/visit-photos/visits/cv1/abc-123.webp");

    respond = () => new Response("{}", { status: 200 });
    await privateStorage.remove("visits/cv1/abc-123.webp");
    expect(calls[2]).toMatchObject({ method: "DELETE", url: "https://abc.supabase.co/storage/v1/object/visit-photos" });

    // Public / signed URL хэзээ ч үүсэхгүй
    expect(calls.some((c) => /\/object\/public\/|\/object\/sign\//.test(c.url))).toBe(false);
  });

  it("missing object → null; bucket env; bad keys refused", async () => {
    process.env.SUPABASE_PRIVATE_BUCKET = "secret-bucket";
    respond = () => new Response('{"error":"not_found"}', { status: 400 });
    expect(await privateStorage.read("receipts/2026-11/x.pdf")).toBeNull();
    expect(calls[0]!.url).toContain("/authenticated/secret-bucket/receipts/2026-11/x.pdf");
    await expect(privateStorage.put("../etc/passwd", Buffer.from(""))).rejects.toThrow(/bad storage key/);
  });

  it("errors don't leak the key", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    respond = () => new Response("Bucket not found", { status: 404 });
    await expect(privateStorage.put("visits/x/y.webp", Buffer.from("a"))).rejects.toThrow(/storage 404/);
    expect(JSON.stringify(log.mock.calls)).not.toContain("service-role-test");
  });

  it("Vercel without Supabase → clear error (disk is read-only)", async () => {
    delete process.env.SUPABASE_URL;
    process.env.VERCEL = "1";
    await expect(privateStorage.put("visits/x/y.webp", Buffer.from("a"))).rejects.toThrow(/Хувийн файлын storage тохируулаагүй/);
    delete process.env.VERCEL;
  });
});
