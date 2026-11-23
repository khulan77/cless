-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'DONE', 'CANCELLED');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'INQUIRY_EMAIL';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "category" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priceFrom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "results" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "suitableFor" TEXT;

-- CreateTable
CREATE TABLE "ProductInquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "note" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "ip" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductInquiry_status_createdAt_idx" ON "ProductInquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductInquiry_phone_createdAt_idx" ON "ProductInquiry"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "ProductInquiry_ip_createdAt_idx" ON "ProductInquiry"("ip", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductInquiry" ADD CONSTRAINT "ProductInquiry_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ───────────── Өгөгдлийн засвар: биелэхгүй амлалт (seed-ийн утга) ─────────────
-- Онлайн төлбөр/хүргэлт 2-р үе шатанд. Сайтын контентод seed-ээс үлдсэн "3 дээж бэлэг",
-- "Бэлгийн хайрцаг үнэгүй", "QPay-ээр аюулгүй төлбөр" амлалт агуулсан утгыг үнэн мэдээллээр солино.
-- Админ эдгээр үгийг агуулаагүй өөрийн текст бичсэн бол ХӨНДӨХГҮЙ.
UPDATE "SiteSetting" SET "value" = '{"items":[
    {"icon":"shield-check","lines":["Албан ёсны дистрибьютор","жинхэнэ бүтээгдэхүүн"]},
    {"icon":"scan-face","lines":["Салон дээр","арьсны оношлогоо"]},
    {"icon":"sparkles","lines":["Гоо сайханчийн","зөвлөгөө"]},
    {"icon":"package","lines":["Салонд ирж","авах"]}
  ]}'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'benefits' AND ("value"::text LIKE '%3 дээж%' OR "value"::text LIKE '%QPay%' OR "value"::text LIKE '%үнэгүй%');

UPDATE "SiteSetting" SET "value" = '{"items":[
    {"icon":"shield-check","label":"Албан ёсны дистрибьютор — жинхэнэ бүтээгдэхүүн"},
    {"icon":"scan-face","label":"Салон дээр арьсны оношлогоо"},
    {"icon":"sparkles","label":"Гоо сайханчийн зөвлөгөө"},
    {"icon":"package","label":"Салонд ирж авах"}
  ]}'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'productBenefits' AND ("value"::text LIKE '%3 дээж%' OR "value"::text LIKE '%Аюулгүй төлбөр%' OR "value"::text LIKE '%үнэгүй%');

UPDATE "SiteSetting" SET "value" = jsonb_set("value", '{messages}', '[
    "Biologique Recherche-ийн Монгол дахь албан ёсны дистрибьютор",
    "Салон дээр арьсны оношлогоо — утсаар цаг аваарай",
    "Гоо сайханчийн зөвлөгөөтэйгөөр арчилгаагаа сонгоорой"
  ]'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'announcement' AND ("value"::text LIKE '%3 дээж%' OR "value"::text LIKE '%үнэгүй оношлогоо%');

-- Нүүрний "Манай салон" блокийн буруу "Шинэ" eyebrow
UPDATE "SiteSetting" SET "value" = "value" - 'eyebrow', "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'salonBanner' AND "value"->>'eyebrow' = 'Шинэ';

-- ───────────── Өгөгдлийн засвар: seed-ийн жишээ холбоо барих мэдээлэл ─────────────
-- "+976 0000 0000", "info@example.mn", хоосон "https://instagram.com/" сайтад гарахгүй.
-- Ажлын цаг одоо салбарын цагийн хуваарьаас (footer.contact.hours хэрэглэгдэхгүй).
UPDATE "Branch" SET "phone" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE "phone" = '+976 0000 0000';

UPDATE "SiteSetting" SET "value" = jsonb_set("value", '{contact,phone}', '""'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'footer' AND "value"->'contact'->>'phone' = '+976 0000 0000';

UPDATE "SiteSetting" SET "value" = jsonb_set("value", '{contact,email}', '""'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'footer' AND "value"->'contact'->>'email' LIKE '%@example.mn';

UPDATE "SiteSetting" SET "value" = jsonb_set("value", '{socials}', COALESCE((
    SELECT jsonb_agg(s) FROM jsonb_array_elements("value"->'socials') s
    WHERE s->>'href' NOT IN ('https://instagram.com/', 'https://facebook.com/', '')
  ), '[]'::jsonb)), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'footer' AND jsonb_typeof("value"->'socials') = 'array';

-- Copyright-д сайтын нэр автоматаар нэмэгдэнэ ("© 2026 <Сайтын нэр>. …")
UPDATE "SiteSetting" SET "value" = jsonb_set("value", '{copyright}', '"Бүх эрх хуулиар хамгаалагдсан."'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'footer' AND "value"->>'copyright' = 'Biologique Recherche Mongolia. Бүх эрх хуулиар хамгаалагдсан.';

-- "Манай салон" блок → шинэ /salon хуудас (seed-ийн утга хэвээр бол)
UPDATE "SiteSetting" SET "value" = jsonb_set("value", '{cta}', '{"label":"Салонтой танилцах","href":"/salon"}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'salonBanner' AND "value"->'cta'->>'href' = '/services' AND "value"->'cta'->>'label' = 'Үйлчилгээ үзэх';

-- Бэлгийн карт зарагдахгүй: seed-ийн "Бэлэг / Бэлгийн карт" ангиллын нэр/танилцуулга
UPDATE "Collection" SET "name" = 'Бэлэг', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'gifts' AND "name" = 'Бэлэг / Бэлгийн карт';
UPDATE "Collection" SET "intro" = 'Хайртай хүмүүстээ зориулсан арчилгааны багц.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'gifts' AND "intro" = 'Хайртай хүмүүстээ зориулсан багц ба бэлгийн карт.';
