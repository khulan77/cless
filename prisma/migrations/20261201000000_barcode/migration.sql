-- PROMPT 12 A3: баркод (POS-ийн баркод уншигч), Smart Logic-ийн код (дараагийн шат). Зөвхөн нэмэлт.
ALTER TABLE "Variant" ADD COLUMN "barcode" TEXT;
ALTER TABLE "Variant" ADD COLUMN "slItemId" TEXT;
CREATE UNIQUE INDEX "Variant_barcode_key" ON "Variant"("barcode");

ALTER TABLE "Service" ADD COLUMN "slItemId" TEXT;
