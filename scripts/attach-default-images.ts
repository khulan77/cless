import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { defaultImage, defaultProductImages } from "@/lib/default-images";

const confirm = process.argv.includes("--confirm");
const host = new URL(process.env.DATABASE_URL ?? "postgresql://x@unknown/x").host;
const replaceable = (src: string | null | undefined) => !src || src.startsWith("/placeholders/");

const SETTING_SLOTS: { key: string; path: (string | number)[]; slot: string }[] = [
  { key: "hero", path: ["image"], slot: "hero" },
  { key: "promoTrio", path: ["items", 0, "image"], slot: "promo.0" },
  { key: "promoTrio", path: ["items", 1, "image"], slot: "promo.1" },
  { key: "promoTrio", path: ["items", 2, "image"], slot: "promo.2" },
  { key: "splitPromo", path: ["image"], slot: "split" },
  { key: "featuredProduct", path: ["image"], slot: "featured" },
  { key: "salonBanner", path: ["image"], slot: "salon" },
  { key: "servicesBanner", path: ["image"], slot: "services" },
];

const dig = (obj: unknown, path: (string | number)[]) => path.reduce<unknown>((o, k) => (o as Record<string | number, unknown> | undefined)?.[k], obj);

const products = await db.product.findMany({ select: { id: true, slug: true, name: true, images: { select: { id: true, url: true } } } });
const productPlan = products
  .map((p) => ({ p, defaults: defaultProductImages(p.slug) }))
  .filter(({ p, defaults }) => defaults.length > 0 && p.images.every((i) => replaceable(i.url)));

const settings = await db.siteSetting.findMany({ where: { key: { in: [...new Set(SETTING_SLOTS.map((s) => s.key))] } } });
const settingPlan = SETTING_SLOTS.flatMap((s) => {
  const row = settings.find((r) => r.key === s.key);
  const img = dig(row?.value, s.path) as { src?: string } | undefined;
  const def = defaultImage(s.slot);
  return row && img && def && replaceable(img.src) ? [{ ...s, from: img.src ?? "", to: def }] : [];
});

console.log(`DB: ${host} · ${confirm ? "БИЧНЭ" : "DRY RUN (--confirm-гүй тул юу ч өөрчлөхгүй)"}`);
console.log(`\nБүтээгдэхүүн (${productPlan.length}):`);
for (const { p, defaults } of productPlan) console.log(`  ${p.slug}: ${p.images.length} placeholder → ${defaults.length} зураг`);
const skipped = products.filter((p) => defaultProductImages(p.slug).length && !productPlan.some((x) => x.p.id === p.id));
if (skipped.length) console.log(`  (бодит зурагтай тул алгассан: ${skipped.map((p) => p.slug).join(", ")})`);
console.log(`\nСайтын контент (${settingPlan.length}):`);
for (const s of settingPlan) console.log(`  ${s.key}.${s.path.join(".")}: ${s.from || "(хоосон)"} → ${s.to}`);

if (confirm) {
  await db.$transaction(async (tx) => {
    for (const { p, defaults } of productPlan) {
      await tx.productImage.deleteMany({ where: { productId: p.id } });
      await tx.productImage.createMany({
        data: defaults.map((d, i) => ({ productId: p.id, url: d.src, alt: `${p.name}${d.size ? ` · ${d.size}` : ""}`, sortOrder: i })),
      });
    }
    for (const key of new Set(settingPlan.map((s) => s.key))) {
      const row = settings.find((r) => r.key === key)!;
      const value = structuredClone(row.value) as Record<string, unknown>;
      for (const s of settingPlan.filter((x) => x.key === key)) (dig(value, s.path) as { src: string }).src = s.to;
      await tx.siteSetting.update({ where: { key }, data: { value: value as Prisma.InputJsonValue } });
    }
  });
  console.log("\nБичлээ. Сайтын кэшийг шинэчлэхийн тулд app-ийг дахин эхлүүлэх эсвэл Сайтын контентоос нэг удаа хадгална уу.");
}
await db.$disconnect();
