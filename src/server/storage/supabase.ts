import "server-only";
import { randomUUID } from "node:crypto";
import type { FileStorage } from "./index";

/**
 * Supabase Storage (REST API, SDK-гүй). Vercel-ийн файлын систем read-only тул production-д зураг энд.
 *  - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (зөвхөн сервер), SUPABASE_STORAGE_BUCKET (анхдагч "media", PUBLIC bucket).
 *  - Нийтийн URL: <SUPABASE_URL>/storage/v1/object/public/<bucket>/<folder>/<file>
 */
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
let fetchOverride: Fetch | undefined;
const fetchImpl: Fetch = (input, init) => (fetchOverride ?? fetch)(input, init);
/** Тестэд */
export function setStorageFetchForTests(f: typeof fetch | undefined) {
  fetchOverride = f;
}

export function supabaseStorageConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const cfg = () => {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  return { base, key, bucket, publicPrefix: `${base}/storage/v1/object/public/${bucket}/` };
};

async function failure(res: Response, op: string): Promise<Error> {
  const body = await res.text().catch(() => "");
  // Түлхүүр, файлын агуулгыг log-д гаргахгүй — статус, богино мессеж л
  console.error("[storage]", { op, status: res.status, message: body.slice(0, 200) });
  return new Error(`Зураг хадгалахад алдаа гарлаа (storage ${res.status}).`);
}

export const supabaseStorage: FileStorage = {
  async put(file, folder) {
    const { base, key, bucket, publicPrefix } = cfg();
    const safeFolder = folder.replace(/[^a-z0-9-]/gi, "") || "misc";
    const name = `${Date.now()}-${randomUUID().slice(0, 8)}.${EXT[file.type] ?? "bin"}`;
    const objectPath = `${safeFolder}/${name}`;
    const res = await fetchImpl(`${base}/storage/v1/object/${bucket}/${objectPath}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": file.type || "application/octet-stream", "cache-control": "31536000", "x-upsert": "false" },
      body: Buffer.from(await file.arrayBuffer()),
    });
    if (!res.ok) throw await failure(res, "put");
    return { url: `${publicPrefix}${objectPath}` };
  },
  async remove(url) {
    const { base, key, bucket, publicPrefix } = cfg();
    if (!url.startsWith(publicPrefix)) return; // энэ bucket-ийн биш (демо /images/…, /uploads/…) — хөндөхгүй
    const objectPath = url.slice(publicPrefix.length);
    if (!/^[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9]+$/i.test(objectPath)) return;
    const res = await fetchImpl(`${base}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ prefixes: [objectPath] }),
    });
    if (!res.ok) throw await failure(res, "remove");
  },
};
