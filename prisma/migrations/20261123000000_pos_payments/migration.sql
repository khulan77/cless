-- CreateEnum
CREATE TYPE "SaleChannel" AS ENUM ('POS', 'ONLINE');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('NOT_ISSUED', 'PENDING', 'ISSUED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CashShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMoveType" AS ENUM ('SALE', 'REFUND', 'PAY_IN', 'PAY_OUT');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('NOT_SENT', 'QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "SkinType" AS ENUM ('DRY', 'OILY', 'COMBINATION', 'NORMAL', 'SENSITIVE');

-- AlterEnum
BEGIN;
CREATE TYPE "SaleStatus_new" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');
ALTER TABLE "Sale" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Sale" ALTER COLUMN "status" TYPE "SaleStatus_new" USING ("status"::text::"SaleStatus_new");
ALTER TYPE "SaleStatus" RENAME TO "SaleStatus_old";
ALTER TYPE "SaleStatus_new" RENAME TO "SaleStatus";
DROP TYPE "SaleStatus_old";
ALTER TABLE "Sale" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PayStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED');
ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PayStatus_new" USING ("status"::text::"PayStatus_new");
ALTER TYPE "PayStatus" RENAME TO "PayStatus_old";
ALTER TYPE "PayStatus_new" RENAME TO "PayStatus";
DROP TYPE "PayStatus_old";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "RefundStatus_new" AS ENUM ('REQUESTED', 'APPROVED', 'COMPLETED', 'REJECTED');
ALTER TABLE "Refund" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Refund" ALTER COLUMN "status" TYPE "RefundStatus_new" USING ("status"::text::"RefundStatus_new");
ALTER TYPE "RefundStatus" RENAME TO "RefundStatus_old";
ALTER TYPE "RefundStatus_new" RENAME TO "RefundStatus";
DROP TYPE "RefundStatus_old";
ALTER TABLE "Refund" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'VISIT_EMAIL';
ALTER TYPE "JobType" ADD VALUE 'QPAY_CANCEL_INVOICE';

-- DropForeignKey
ALTER TABLE "Visit" DROP CONSTRAINT "Visit_managerId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_createdById_fkey";

-- DropForeignKey
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_variantId_fkey";

-- DropForeignKey
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_paymentId_fkey";

-- DropIndex
DROP INDEX "Sale_status_createdAt_idx";

-- DropIndex
DROP INDEX "Sale_source_createdAt_idx";

-- DropIndex
DROP INDEX "Payment_qpayInvoiceId_key";

-- DropIndex
DROP INDEX "Payment_status_createdAt_idx";

-- DropIndex
DROP INDEX "CashShift_openedAt_idx";

-- AlterTable
-- Одоо байгаа мөрүүдэд утга оноохын тулд эхлээд NULL-тэй (доор backfill хийгээд NOT NULL болгоно)
ALTER TABLE "StockMovement" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "skinType",
ADD COLUMN     "skinType" "SkinType";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Visit" DROP COLUMN "managerId",
ADD COLUMN     "branchId" TEXT NOT NULL,
ADD COLUMN     "conductedById" TEXT NOT NULL,
ADD COLUMN     "emailError" TEXT,
ADD COLUMN     "emailStatus" "EmailStatus" NOT NULL DEFAULT 'NOT_SENT',
DROP COLUMN "skinType",
ADD COLUMN     "skinType" "SkinType";

-- AlterTable
ALTER TABLE "VisitRecommendation" ADD COLUMN     "purchased" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "instructions" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "discount",
DROP COLUMN "source",
ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "branchId" TEXT NOT NULL,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "channel" "SaleChannel" NOT NULL DEFAULT 'POS',
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "discountApprovedById" TEXT,
ADD COLUMN     "lineDiscountTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "receiptStatus" "ReceiptStatus" NOT NULL DEFAULT 'NOT_ISSUED',
ADD COLUMN     "refundedAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "saleDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "saleDiscountReason" TEXT,
ADD COLUMN     "vatTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "number" DROP NOT NULL,
ALTER COLUMN "createdById" SET NOT NULL,
ALTER COLUMN "subtotal" SET DEFAULT 0,
ALTER COLUMN "total" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "SaleItem" DROP COLUMN "discount",
ADD COLUMN     "allocatedSaleDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lineDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lineDiscountReason" TEXT,
ADD COLUMN     "refundedQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "skuSnapshot" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vatAmount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "lineTotal" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "qpayInvoiceId",
DROP COLUMN "raw",
ADD COLUMN     "approvalCode" TEXT,
ADD COLUMN     "cardLast4" TEXT,
ADD COLUMN     "change" INTEGER,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "idempotencyKey" TEXT NOT NULL,
ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "tendered" INTEGER;

-- AlterTable
ALTER TABLE "Refund" DROP COLUMN "paymentId",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "method" "PayMethod" NOT NULL,
ADD COLUMN     "restock" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "items" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'REQUESTED';

-- AlterTable
ALTER TABLE "OutboxJob" ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "CashShift" ADD COLUMN     "branchId" TEXT NOT NULL,
ADD COLUMN     "difference" INTEGER,
ADD COLUMN     "status" "CashShiftStatus" NOT NULL DEFAULT 'OPEN';

-- DropEnum
DROP TYPE "SaleSource";

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerInvoiceId" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "providerStatus" TEXT NOT NULL,
    "qrText" TEXT,
    "qrImage" TEXT,
    "deeplinks" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "type" "CashMoveType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentId" TEXT,
    "refundId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleCounter" (
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SaleCounter_pkey" PRIMARY KEY ("branchId","date")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_providerInvoiceId_key" ON "PaymentTransaction"("providerInvoiceId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentId_idx" ON "PaymentTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "CashMovement_shiftId_createdAt_idx" ON "CashMovement"("shiftId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_createdAt_idx" ON "StockMovement"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Visit_branchId_createdAt_idx" ON "Visit"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_branchId_status_createdAt_idx" ON "Sale"("branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_status_lockedAt_idx" ON "Sale"("status", "lockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_status_method_createdAt_idx" ON "Payment"("status", "method", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxJob_dedupeKey_key" ON "OutboxJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "CashShift_branchId_openedAt_idx" ON "CashShift"("branchId", "openedAt");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_discountApprovedById_fkey" FOREIGN KEY ("discountApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "CashShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleCounter" ADD CONSTRAINT "SaleCounter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ═══════════════ Гараар нэмсэн: backfill, хамгаалалт (Prisma дэмждэггүй) ═══════════════

-- Анхны салбар "CL" — одоо байгаа StockMovement-уудыг түүнд онооно. Нэр/хаягийг seed шинэчилнэ.
INSERT INTO "Branch" ("id", "code", "name", "updatedAt")
VALUES ('branch_cl', 'CL', 'CLÉSS', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

UPDATE "StockMovement" SET "branchId" = (SELECT "id" FROM "Branch" WHERE "code" = 'CL') WHERE "branchId" IS NULL;
ALTER TABLE "StockMovement" ALTER COLUMN "branchId" SET NOT NULL;

-- Нэг салбарт нэг л нээлттэй кассын ээлж
CREATE UNIQUE INDEX "CashShift_one_open_per_branch" ON "CashShift" ("branchId") WHERE "status" = 'OPEN';

-- Sale: мөнгөн дүн сөрөг биш, дугааргүй байж болох нь зөвхөн DRAFT / (DRAFT-аас) CANCELLED
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_amounts_nonneg_check" CHECK (
  "subtotal" >= 0 AND "lineDiscountTotal" >= 0 AND "saleDiscount" >= 0 AND "total" >= 0
  AND "vatTotal" >= 0 AND "paidAmount" >= 0 AND "refundedAmount" >= 0 AND "version" >= 0
);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_refund_le_paid_check" CHECK ("refundedAmount" <= "paidAmount");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_number_when_locked_check" CHECK (
  "status" IN ('DRAFT', 'CANCELLED') OR "number" IS NOT NULL
);

-- SaleItem: дүнгүүд сөрөг биш, буцаалт тооноос хэтрэхгүй, төрөлд тохирох холбоос
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_amounts_check" CHECK (
  "unitPrice" >= 0 AND "unitCostSnapshot" >= 0 AND "lineDiscount" >= 0
  AND "allocatedSaleDiscount" >= 0 AND "lineTotal" >= 0 AND "vatAmount" >= 0
);
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_refunded_qty_check" CHECK ("refundedQty" >= 0 AND "refundedQty" <= "qty");
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_kind_ref_check" CHECK (
  ("kind" = 'PRODUCT' AND "variantId" IS NOT NULL) OR ("kind" = 'SERVICE' AND "serviceId" IS NOT NULL)
);

-- Payment: бэлэн төлбөрт өгсөн мөнгө ≥ дүн, хариулт = өгсөн − дүн (amount > 0 нь init migration-д бий)
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cash_change_check" CHECK (
  "method" <> 'CASH' OR ("tendered" IS NOT NULL AND "tendered" >= "amount" AND "change" = "tendered" - "amount")
);
CREATE INDEX "Payment_processing_idx" ON "Payment" ("createdAt") WHERE "status" = 'PROCESSING';

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_cash_nonneg_check" CHECK (
  "openingCash" >= 0 AND ("countedCash" IS NULL OR "countedCash" >= 0)
);
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_amount_nonzero_check" CHECK ("amount" <> 0);
ALTER TABLE "SaleCounter" ADD CONSTRAINT "SaleCounter_last_number_check" CHECK ("lastNumber" >= 0);
