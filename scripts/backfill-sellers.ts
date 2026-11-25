/**
 * Хуучин борлуулалтын бүтээгдэхүүний мөрөнд "Зарсан" ажилтныг (SaleItem.sellerId) нөхнө — PROMPT 14 §5.
 * Дүрэм: мөрийн ажилтан → цагийн гоо сайханч → тухайн борлуулалтын эхний үйлчилгээний ажилтан (LEGACY_SELLER).
 * Олдохгүй мөр NULL хэвээр (тайланд "Тодорхойгүй").
 *
 *   bun run sellers:backfill                 # зөвхөн тоолно (dry-run)
 *   bun run sellers:backfill --apply         # локал DB-д бичнэ
 *   bun run sellers:backfill --apply --production-approved   # локал бус DB — ЗӨВХӨН зөвшөөрөл авсны дараа
 *
 * Зөвхөн тоо хэвлэнэ (нэр, дүн, холболтын мөр хэвлэхгүй).
 */
import { db } from "@/server/db";
import { backfillSellers } from "@/server/modules/sales/seller";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const url = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
const local = host === "localhost" || host === "127.0.0.1";

if (apply && !local && !args.has("--production-approved")) {
  console.error("Локал бус DB. Зөвшөөрөл авсны дараа --production-approved нэмж ажиллуулна.");
  process.exit(1);
}

const r = await backfillSellers({ dryRun: !apply });
console.log(apply ? `Нөхсөн мөр: ${r.filled} / нэр дэвшигч ${r.candidates}` : `Нөхөх боломжтой мөр: ${r.candidates} (dry-run — бичээгүй)`);
await db.$disconnect();
