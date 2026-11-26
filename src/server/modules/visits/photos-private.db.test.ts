/**
 * PROMPT 21: айлчлалын зураг Supabase PRIVATE bucket-д — upload → object path (нэр/утасгүй), эрхтэй → 200 (сервер
 * татаж өгнө), эрхгүй → харуулахгүй, public URL үүсэхгүй. ACCOUNTANT visit-photo:read-гүй.
 */
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { setPrivateStorageFetchForTests } from "@/server/storage/private";
import { makeCustomer, makeUser, resetDb } from "../../../../tests/db-helpers";
import { uploadVisitPhoto } from "./photos";

let current: { id: string; role: Role } | null = null;
vi.mock("@/server/auth/session", () => ({ getCurrentUser: async () => current }));
const { GET } = await import("@/app/api/media/visit/[id]/route");

const store = new Map<string, Buffer>();
const urls: string[] = [];

beforeEach(async () => {
  await resetDb();
  current = null;
  store.clear();
  urls.length = 0;
  process.env.SUPABASE_URL = "https://abc.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  setPrivateStorageFetchForTests(async (url, init) => {
    urls.push(url);
    const m = /\/storage\/v1\/object\/(?:authenticated\/)?visit-photos\/(.+)$/.exec(url);
    if ((init?.method ?? "GET") === "POST" && m) {
      store.set(m[1]!, Buffer.from(init!.body as Uint8Array));
      return new Response("{}", { status: 200 });
    }
    if ((init?.method ?? "GET") === "GET" && m) return store.has(m[1]!) ? new Response(new Uint8Array(store.get(m[1]!)!), { status: 200 }) : new Response("{}", { status: 400 });
    return new Response("{}", { status: 200 });
  });
});
afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  setPrivateStorageFetchForTests(undefined);
});

const call = (id: string) => GET(new Request(`http://x/api/media/visit/${id}`) as never, { params: Promise.resolve({ id }) } as never);

describe("visit photos — private bucket", () => {
  it("upload → visits/<visit>/<uuid>.webp; MANAGER 200; ACCOUNTANT / нэвтрээгүй харахгүй; public URL үгүй", async () => {
    const manager = await makeUser("MANAGER");
    const accountant = await makeUser("ACCOUNTANT");
    const customer = await makeCustomer();
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#c99" } }).png().toBuffer();
    const file = new File([new Uint8Array(png)], "a.png", { type: "image/png" });
    const photo = await uploadVisitPhoto({ customerId: customer.id, kind: "BEFORE", consent: true, file }, { id: manager.id, role: "MANAGER" });

    expect(photo.storageKey).toMatch(/^visits\/unlinked\/[0-9a-f-]{36}\.webp$/);
    expect(photo.storageKey).not.toContain(customer.phone);
    expect(store.has(photo.storageKey)).toBe(true);

    current = { id: manager.id, role: "MANAGER" };
    const ok = await call(photo.id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toContain("no-store");

    expect(can("ACCOUNTANT", "visit-photo:read")).toBe(false);
    current = { id: accountant.id, role: "ACCOUNTANT" };
    expect((await call(photo.id)).status).toBe(404); // байгаа эсэхийг задруулахгүй (403-ийн оронд)
    current = null;
    expect((await call(photo.id)).status).toBe(401);

    expect(urls.some((u) => /\/object\/public\/|\/object\/sign\//.test(u))).toBe(false);
    expect(await db.visitPhoto.count()).toBe(1);
  });

  it("4MB-аас том файл → ойлгомжтой алдаа", async () => {
    const manager = await makeUser("MANAGER");
    const customer = await makeCustomer();
    const file = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    await expect(uploadVisitPhoto({ customerId: customer.id, kind: "AFTER", consent: true, file }, { id: manager.id, role: "MANAGER" })).rejects.toThrow(/4MB/);
  });
});
