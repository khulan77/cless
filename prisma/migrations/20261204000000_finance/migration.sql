-- CreateEnum
CREATE TYPE "ExpenseKind" AS ENUM ('UTILITY', 'INTERNET', 'OTHER', 'PAYROLL', 'SOCIAL_INSURANCE', 'PIT');

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ExpenseKind" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "vatIncluded" BOOLEAN NOT NULL DEFAULT false,
    "vatAmount" INTEGER NOT NULL DEFAULT 0,
    "reference" TEXT,
    "vendor" TEXT,
    "note" TEXT,
    "paidVia" "PayMethod",
    "receiptPath" TEXT,
    "payrollPeriodId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_categoryId_date_idx" ON "Expense"("categoryId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_payrollPeriodId_categoryId_key" ON "Expense"("payrollPeriodId", "categoryId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Анхны ангилал (PROMPT 18). Код — TODO: нягтлангийн дансны кодоор солино (Зардал → Ангилал).
INSERT INTO "ExpenseCategory" ("id", "code", "name", "kind", "isSystem", "sortOrder", "updatedAt") VALUES
  ('expcat_util',    'UTIL',    'Ашиглалтын төлбөр',                         'UTILITY',          false, 10, CURRENT_TIMESTAMP),
  ('expcat_net',     'NET',     'Интернэтийн төлбөр',                        'INTERNET',         false, 20, CURRENT_TIMESTAMP),
  ('expcat_other',   'OTHER',   'Нэмэлт зардал',                             'OTHER',            false, 30, CURRENT_TIMESTAMP),
  ('expcat_payroll', 'PAYROLL', 'Цалингийн зардал',                          'PAYROLL',          true,  90, CURRENT_TIMESTAMP),
  ('expcat_si',      'SI',      'Нийгмийн даатгалын шимтгэл (ажил олгогч)',  'SOCIAL_INSURANCE', true,  91, CURRENT_TIMESTAMP),
  ('expcat_pit',     'PIT',     'ХХОАТ',                                     'PIT',              true,  92, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
