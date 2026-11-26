import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Хувийн файлын хадгалалт (айлчлалын өмнө/дараах зураг, зардлын баримт) — НИЙТЭД ХЭЗЭЭ Ч БИШ.
 * Зөвхөн эрх шалгадаг route-оор (сервер татаж stream хийнэ) уншигдана. DB-д зөвхөн object path.
 *
 *  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY байвал Supabase Storage-ийн PRIVATE bucket
 *    (SUPABASE_PRIVATE_BUCKET, анхдагч "visit-photos", Public: OFF). Public URL үүсгэхгүй, signed URL ч үгүй.
 *  - Үгүй бол локал диск: STORAGE_PRIVATE_DIR (VPS volume) эсвэл <project>/.private-storage (dev, git-ignored).
 *  - Vercel дээр Supabase тохируулаагүй бол хадгалахдаа ойлгомжтой алдаа (диск read-only).
 * Түлхүүр, файлын агуулгыг log-д гаргахгүй.
 */

const KEY_RE = /^[a-z0-9-]+(\/[a-z0-9-]+)*\.[a-z0-9]+$/i;
const assertKey = (key: string) => {
  if (!KEY_RE.test(key)) throw new Error("bad storage key");
};

// ───────────────────────── Supabase (private bucket) ─────────────────────────

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
let fetchOverride: Fetch | undefined;
const doFetch: Fetch = (input, init) => (fetchOverride ?? fetch)(input, init);
/** Тестэд */
export function setPrivateStorageFetchForTests(f: Fetch | undefined) {
  fetchOverride = f;
}

export function privateSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const cfg = () => ({
  base: (process.env.SUPABASE_URL ?? "").replace(/\/+$/, ""),
  key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  bucket: process.env.SUPABASE_PRIVATE_BUCKET || "visit-photos",
});
const auth = (key: string) => ({ authorization: `Bearer ${key}`, apikey: key });

async function failure(res: Response, op: string) {
  const body = await res.text().catch(() => "");
  console.error("[private-storage]", { op, status: res.status, message: body.slice(0, 200) });
  return new Error(`Хувийн файл хадгалахад алдаа гарлаа (storage ${res.status}).`);
}

const supabasePrivate = {
  async put(key: string, data: Buffer, contentType: string) {
    const { base, key: k, bucket } = cfg();
    const res = await doFetch(`${base}/storage/v1/object/${bucket}/${key}`, {
      method: "POST",
      headers: { ...auth(k), "content-type": contentType, "x-upsert": "false", "cache-control": "no-store" },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw await failure(res, "put");
  },
  /** Service role-оор (authenticated endpoint) — нийтийн URL биш */
  async read(key: string): Promise<Buffer | null> {
    const { base, key: k, bucket } = cfg();
    const res = await doFetch(`${base}/storage/v1/object/authenticated/${bucket}/${key}`, { headers: auth(k) });
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) throw await failure(res, "read");
    return Buffer.from(await res.arrayBuffer());
  },
  async remove(key: string) {
    const { base, key: k, bucket } = cfg();
    const res = await doFetch(`${base}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: { ...auth(k), "content-type": "application/json" },
      body: JSON.stringify({ prefixes: [key] }),
    });
    if (!res.ok) throw await failure(res, "remove");
  },
};

// ───────────────────────── Локал диск (dev / VPS) ─────────────────────────

const root = () => path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_PRIVATE_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), ".private-storage"));

function resolveKey(key: string): string {
  assertKey(key);
  const full = path.join(/* turbopackIgnore: true */ root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("bad storage key"); // path traversal
  return full;
}

const localPrivate = {
  async put(key: string, data: Buffer) {
    const full = resolveKey(key);
    await mkdir(/* turbopackIgnore: true */ path.dirname(full), { recursive: true });
    await writeFile(/* turbopackIgnore: true */ full, data, { flag: "wx" });
  },
  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(/* turbopackIgnore: true */ resolveKey(key));
    } catch {
      return null;
    }
  },
  async remove(key: string) {
    await unlink(/* turbopackIgnore: true */ resolveKey(key)).catch(() => undefined);
  },
};

// ───────────────────────── Нийтийн interface ─────────────────────────

const MIME: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" };
const mimeOf = (key: string) => MIME[key.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";

export const privateStorage = {
  async put(key: string, data: Buffer) {
    assertKey(key);
    if (privateSupabaseConfigured()) return supabasePrivate.put(key, data, mimeOf(key));
    if (process.env.VERCEL) throw new Error("Хувийн файлын storage тохируулаагүй байна (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, private bucket).");
    return localPrivate.put(key, data);
  },
  async read(key: string): Promise<Buffer | null> {
    assertKey(key);
    return privateSupabaseConfigured() ? supabasePrivate.read(key) : localPrivate.read(key);
  },
  async remove(key: string) {
    assertKey(key);
    if (privateSupabaseConfigured()) return supabasePrivate.remove(key).catch(() => undefined);
    return localPrivate.remove(key);
  },
};
