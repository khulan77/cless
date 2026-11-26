/**
 * Зураг upload-ын хязгаар — клиент (урьдчилан шалгах) ба сервер хуваалцана.
 * Vercel-ийн функцийн хүсэлтийн хязгаар 4.5MB тул 4MB (multipart-ын нэмэлттэй ч багтана).
 */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_LABEL = "4MB";

/** Буруу бол хэрэглэгчид ойлгомжтой мессеж, зөв бол null */
export function imageFileError(f: { name: string; type: string; size: number }): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type)) return `"${f.name}" — зөвхөн JPG, PNG, WEBP, AVIF зураг оруулна.`;
  if (f.size > MAX_IMAGE_BYTES) return `"${f.name}" — ${(f.size / 1024 / 1024).toFixed(1)}MB байна. ${MAX_IMAGE_LABEL}-аас ихгүй зураг оруулна уу (жишээ нь squoosh.app-аар багасгана).`;
  return null;
}
