import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Хувийн файлын хадгалалт (айлчлалын зураг г.м.) — public/-ээс ГАДУУР. Зөвхөн эрх шалгадаг route-оор
 * уншигдана. STORAGE_PRIVATE_DIR (VPS дээр volume), байхгүй бол <project>/.private-storage (git-ignored).
 */
const root = () => path.resolve(process.env.STORAGE_PRIVATE_DIR || path.join(process.cwd(), ".private-storage"));

function resolveKey(key: string): string {
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*\.[a-z0-9]+$/i.test(key)) throw new Error("bad storage key");
  const full = path.join(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("bad storage key"); // path traversal
  return full;
}

export const privateStorage = {
  async put(key: string, data: Buffer) {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: "wx" });
  },
  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(resolveKey(key));
    } catch {
      return null;
    }
  },
  async remove(key: string) {
    await unlink(resolveKey(key)).catch(() => undefined);
  },
};
