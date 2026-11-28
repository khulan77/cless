-- PROMPT 29: хоёр QPay merchant данс (additive). Хуучин Payment мөр — NULL (= A).
-- CreateEnum
CREATE TYPE "QPayAccount" AS ENUM ('A', 'B');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "qpayAccount" "QPayAccount";
