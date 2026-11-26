import "server-only";
import { localStorage } from "./local";
import { supabaseStorage, supabaseStorageConfigured } from "./supabase";

/**
 * Файл хадгалах abstraction. S3/Cloudinary руу шилжихэд зөвхөн доорх
 * `storage`-ийг өөр implementation-оор солино.
 */
export interface FileStorage {
  /** Файлыг хадгалж нийтэд харагдах URL буцаана */
  put(file: File, folder: string): Promise<{ url: string }>;
  /** Энэ storage-д хамаарах URL бол устгана (бусдыг үл тооно) */
  remove(url: string): Promise<void>;
}

/**
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY байвал Supabase Storage (Vercel), үгүй бол локал диск (dev, VPS volume).
 * Сонголтыг дуудах бүрт хийнэ (env-ийг тестэд солих боломжтой).
 */
const pick = (): FileStorage => (supabaseStorageConfigured() ? supabaseStorage : localStorage);

export const storage: FileStorage = {
  put: (file, folder) => {
    // Vercel-ийн диск read-only, хадгалагдахгүй — ойлгомжтой алдаа
    if (!supabaseStorageConfigured() && process.env.VERCEL) {
      return Promise.reject(new Error("Зураг хадгалах storage тохируулаагүй байна (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)."));
    }
    return pick().put(file, folder);
  },
  remove: (url) => pick().remove(url),
};

export { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/upload-limits";
