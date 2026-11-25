-- CreateEnum
CREATE TYPE "PayrollKind" AS ENUM ('ADVANCE', 'FINAL', 'FULL');

-- CreateEnum
CREATE TYPE "WorkDayStatus" AS ENUM ('WORKED', 'HALF_DAY', 'PAID_LEAVE', 'UNPAID_LEAVE', 'SICK', 'ABSENT', 'OFF');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('ADDITION', 'DEDUCTION');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ACCOUNTANT';

-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "advancePaid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gross" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "plannedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "siEmployee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "siEmployer" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workedDays" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PayrollPeriod" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "calculatedAt" TIMESTAMP(3),
ADD COLUMN     "kind" "PayrollKind" NOT NULL DEFAULT 'FULL',
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "sellerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bankAccountEnc" TEXT,
ADD COLUMN     "siCategory" TEXT;

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" "PayrollAdjustmentType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkDay" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "WorkDayStatus" NOT NULL,
    "hours" DOUBLE PRECISION,
    "note" TEXT,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryHistory" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "monthly" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRateSet" (
    "id" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "employeeSiBp" INTEGER NOT NULL DEFAULT 0,
    "employerRates" JSONB NOT NULL DEFAULT '[]',
    "siBreakdown" JSONB NOT NULL DEFAULT '[]',
    "siCap" INTEGER,
    "pitBp" INTEGER NOT NULL DEFAULT 0,
    "pitCredits" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRateSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollAdjustment_periodId_staffId_idx" ON "PayrollAdjustment"("periodId", "staffId");

-- CreateIndex
CREATE INDEX "WorkDay_date_idx" ON "WorkDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDay_staffId_date_key" ON "WorkDay"("staffId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryHistory_staffId_effectiveFrom_key" ON "SalaryHistory"("staffId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRateSet_effectiveFrom_key" ON "PayrollRateSet"("effectiveFrom");

-- CreateIndex
CREATE INDEX "SaleItem_sellerId_idx" ON "SaleItem"("sellerId");

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkDay" ADD CONSTRAINT "WorkDay_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkDay" ADD CONSTRAINT "WorkDay_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRateSet" ADD CONSTRAINT "PayrollRateSet_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
