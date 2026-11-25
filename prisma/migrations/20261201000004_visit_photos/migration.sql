-- PROMPT 12 A9: айлчлалын өмнө/дараах зураг (хувийн хавтас), үйлчлүүлэгчийн зөвшөөрөл. Зөвхөн нэмэлт.
ALTER TABLE "Customer" ADD COLUMN "photoConsentAt" TIMESTAMP(3);

CREATE TYPE "PhotoKind" AS ENUM ('BEFORE', 'AFTER');

CREATE TABLE "VisitPhoto" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "visitId" TEXT,
    "kind" "PhotoKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisitPhoto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VisitPhoto_storageKey_key" ON "VisitPhoto"("storageKey");
CREATE INDEX "VisitPhoto_customerId_createdAt_idx" ON "VisitPhoto"("customerId", "createdAt");
CREATE INDEX "VisitPhoto_appointmentId_idx" ON "VisitPhoto"("appointmentId");
CREATE INDEX "VisitPhoto_visitId_idx" ON "VisitPhoto"("visitId");
ALTER TABLE "VisitPhoto" ADD CONSTRAINT "VisitPhoto_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitPhoto" ADD CONSTRAINT "VisitPhoto_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VisitPhoto" ADD CONSTRAINT "VisitPhoto_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VisitPhoto" ADD CONSTRAINT "VisitPhoto_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
