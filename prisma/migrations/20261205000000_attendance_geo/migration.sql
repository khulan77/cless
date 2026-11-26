-- CreateEnum
CREATE TYPE "AttendanceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('GEO', 'MANAGER', 'AUTO_CLOSE');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "geoRadiusM" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "WorkDay" ADD COLUMN     "fromEvents" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "AttendanceEventType" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "accuracyM" DOUBLE PRECISION,
    "distanceM" DOUBLE PRECISION,
    "ipHash" TEXT,
    "source" "AttendanceSource" NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceEvent_staffId_at_idx" ON "AttendanceEvent"("staffId", "at");

-- CreateIndex
CREATE INDEX "AttendanceEvent_at_idx" ON "AttendanceEvent"("at");

-- PROMPT 18-ийн 20261204000000_finance migration-д дутуу орсон 2 FK (SQL хуулахад таслагдсан) — нэмэлтээр засна.
-- Одоо байгаа мөр бүр хүчинтэй (системийн мөр үеэр, бүртгэгч хэрэглэгчээр үүссэн) тул шууд нэмж болно.
-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

