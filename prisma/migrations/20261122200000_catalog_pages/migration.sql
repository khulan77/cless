-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('SINGLE', 'BUNDLE');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('PROTOCOL', 'SIMILAR', 'BUNDLE_SUGGESTION');

-- AlterEnum
ALTER TYPE "BadgeType" ADD VALUE 'ONLINE_EXCLUSIVE';

-- ═════ Product: өгөгдлийг хадгалж хөрвүүлнэ ═════
ALTER TABLE "Product"
ADD COLUMN     "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "clinicalNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "environmental" JSONB,
ADD COLUMN     "kind" "ProductKind" NOT NULL DEFAULT 'SINGLE',
ADD COLUMN     "recommendedFor" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "skinScience" TEXT,
ADD COLUMN     "tagline" TEXT;

-- subtitle ("Цэвэршүүлэх / Батга") → benefits массив
UPDATE "Product" SET "benefits" = ARRAY(
  SELECT btrim(x) FROM unnest(string_to_array("subtitle", '/')) AS x WHERE btrim(x) <> ''
);
ALTER TABLE "Product" DROP COLUMN "subtitle";

-- howToUse текст → мөр бүр нэг алхам (USING-д subquery хориотой тул шинэ багана)
ALTER TABLE "Product" ADD COLUMN "howToUse_new" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "Product" SET "howToUse_new" = ARRAY(
  SELECT btrim(x) FROM unnest(regexp_split_to_array(coalesce("howToUse", ''), E'\\n+')) AS x WHERE btrim(x) <> ''
);
ALTER TABLE "Product" DROP COLUMN "howToUse";
ALTER TABLE "Product" RENAME COLUMN "howToUse_new" TO "howToUse";

-- ═════ Collection: нэр солих (өгөгдөл хадгална) + шатлал ═════
ALTER TABLE "Collection" RENAME COLUMN "description" TO "intro";
ALTER TABLE "Collection" RENAME COLUMN "image" TO "tileImage";
ALTER TABLE "Collection" DROP COLUMN "navGroup",
ADD COLUMN     "bannerImage" TEXT,
ADD COLUMN     "heading" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "seoText" TEXT,
ADD COLUMN     "showInMenu" BOOLEAN NOT NULL DEFAULT true;

-- Нэр томьёоны толь: "/collections/serum"
UPDATE "Collection" SET "slug" = 'serum' WHERE "slug" = 'serums'
  AND NOT EXISTS (SELECT 1 FROM "Collection" WHERE "slug" = 'serum');

-- ═════ ProductCollection: sortOrder → position ═════
ALTER TABLE "ProductCollection" RENAME COLUMN "sortOrder" TO "position";
ALTER INDEX "ProductCollection_collectionId_sortOrder_idx" RENAME TO "ProductCollection_collectionId_position_idx";

-- CreateTable
CREATE TABLE "ProductRelation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleItem" (
    "id" TEXT NOT NULL,
    "bundleProductId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionTile" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "image" TEXT NOT NULL,
    "eyebrow" TEXT,
    "title" TEXT NOT NULL,
    "text" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionTile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRelation_productId_type_position_idx" ON "ProductRelation"("productId", "type", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRelation_productId_relatedId_type_key" ON "ProductRelation"("productId", "relatedId", "type");

-- CreateIndex
CREATE INDEX "BundleItem_variantId_idx" ON "BundleItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleItem_bundleProductId_variantId_key" ON "BundleItem"("bundleProductId", "variantId");

-- CreateIndex
CREATE INDEX "CollectionTile_collectionId_position_idx" ON "CollectionTile"("collectionId", "position");

-- CreateIndex
CREATE INDEX "Collection_parentId_sortOrder_idx" ON "Collection"("parentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_relatedId_fkey" FOREIGN KEY ("relatedId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_bundleProductId_fkey" FOREIGN KEY ("bundleProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionTile" ADD CONSTRAINT "CollectionTile_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

