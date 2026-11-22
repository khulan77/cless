import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStorage } from "./index";

const ROOT = path.join(process.cwd(), "public", "uploads");
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Локал диск (`public/uploads`). Анхаар: `next start` нь build-ийн дараа нэмэгдсэн
 * public файлыг үйлчлэхгүй байж болзошгүй — production-д S3 руу шилжинэ.
 */
export const localStorage: FileStorage = {
  async put(file, folder) {
    const safeFolder = folder.replace(/[^a-z0-9-]/gi, "");
    const ext = EXT[file.type] ?? "bin";
    const name = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const dir = path.join(ROOT, safeFolder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    return { url: `/uploads/${safeFolder}/${name}` };
  },
  async remove(url) {
    if (!url.startsWith("/uploads/")) return;
    const full = path.join(process.cwd(), "public", url);
    if (!full.startsWith(ROOT)) return; // path traversal хамгаалалт
    await unlink(full).catch(() => undefined);
  },
};
