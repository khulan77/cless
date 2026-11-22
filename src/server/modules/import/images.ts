/**
 * Импортын зургийн URL-ийг татаж File болгоно (дараа нь storage.put).
 * Хамгаалалт: зөвхөн http(s), дотоод сүлжээний хаяг (SSRF) хориглоно, redirect бүрийг дахин шалгана,
 * 5MB, 15 секунд, файлын төрлийг magic byte-аар (Content-Type-д итгэхгүй) — JPG/PNG/WEBP.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { infra } from "@/i18n/mn.infra";
import { MAX_IMAGE_BYTES } from "@/server/storage";

const M = infra.import.image;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

export class ImageFetchError extends Error {}

/** IPv4/IPv6 хувийн, loopback, link-local, CGNAT, multicast г.м. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return s === "::" || s === "::1" || /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s);
  }
  return true;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImageFetchError(M.badUrl);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ImageFetchError(M.badUrl);
  if (url.username || url.password) throw new ImageFetchError(M.badUrl);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) throw new ImageFetchError(M.privateHost);
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => {
    throw new ImageFetchError(M.network);
  });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) throw new ImageFetchError(M.privateHost);
  return url;
}

export function sniffImageType(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    b.length >= 12 &&
    String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) === "RIFF" &&
    String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export async function fetchImage(raw: string, fetcher: typeof fetch = fetch): Promise<File> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = await assertPublicUrl(raw);
  let res: Response | undefined;
  try {
    for (let hop = 0; ; hop++) {
      res = await fetcher(url, { redirect: "manual", signal, headers: { accept: "image/jpeg,image/png,image/webp" } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        if (hop >= MAX_REDIRECTS) throw new ImageFetchError(M.tooManyRedirects);
        url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
        continue;
      }
      break;
    }
  } catch (e) {
    if (e instanceof ImageFetchError) throw e;
    throw new ImageFetchError(signal.aborted ? M.timeout : M.network);
  }
  if (!res.ok || !res.body) throw new ImageFetchError(M.httpStatus(res.status));
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_IMAGE_BYTES) throw new ImageFetchError(M.tooLarge);

  // Урсгалаар уншиж, хязгаар давбал зогсооно
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new ImageFetchError(M.tooLarge);
      }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof ImageFetchError) throw e;
    throw new ImageFetchError(signal.aborted ? M.timeout : M.network);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  const type = sniffImageType(buf);
  if (!type) throw new ImageFetchError(M.badType);
  return new File([buf], `import.${EXT[type]}`, { type });
}
