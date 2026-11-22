import "server-only";
import { localStorage } from "./local";

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

export const storage: FileStorage = localStorage;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
