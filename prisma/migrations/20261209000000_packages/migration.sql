-- CreateEnum
CREATE TYPE "CustomerPackageStatus" AS ENUM ('ACTIVE', 'USED_UP', 'EXPIRED', 'REFUNDED');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'PACKAGE_EXPIRY';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "customerPackageId" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "packageTemplateId" TEXT;

-- CreateTable
CREATE TABLE "PackageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "paidSessions" INTEGER NOT NULL,
    "bonusSessions" INTEGER NOT NULL DEFAULT 0,
    "price" INTEGER NOT NULL,
    "validDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageTemplateService" (
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "PackageTemplateService_pkey" PRIMARY KEY ("packageId","serviceId")
);

-- CreateTable
CREATE TABLE "CustomerPackage" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "saleItemId" TEXT,
    "name" TEXT NOT NULL,
    "serviceIds" TEXT[],
    "totalSessions" INTEGER NOT NULL,
    "usedSessions" INTEGER NOT NULL DEFAULT 0,
    "paidAmount" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" "CustomerPackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "refundAmount" INTEGER,
    "refundPenalty" INTEGER,
    "refundedAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageRedemption" (
    "id" TEXT NOT NULL,
    "customerPackageId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT,
    "unitValue" INTEGER NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reverseReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPackage_saleItemId_key" ON "CustomerPackage"("saleItemId");

-- CreateIndex
CREATE INDEX "CustomerPackage_customerId_status_idx" ON "CustomerPackage"("customerId", "status");

-- CreateIndex
CREATE INDEX "CustomerPackage_status_expiresAt_idx" ON "CustomerPackage"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PackageRedemption_appointmentId_key" ON "PackageRedemption"("appointmentId");

-- CreateIndex
CREATE INDEX "PackageRedemption_customerPackageId_idx" ON "PackageRedemption"("customerPackageId");

-- CreateIndex
CREATE INDEX "PackageRedemption_createdAt_idx" ON "PackageRedemption"("createdAt");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerPackageId_fkey" FOREIGN KEY ("customerPackageId") REFERENCES "CustomerPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_packageTemplateId_fkey" FOREIGN KEY ("packageTemplateId") REFERENCES "PackageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageTemplateService" ADD CONSTRAINT "PackageTemplateService_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PackageTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageTemplateService" ADD CONSTRAINT "PackageTemplateService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PackageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_customerPackageId_fkey" FOREIGN KEY ("customerPackageId") REFERENCES "CustomerPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

