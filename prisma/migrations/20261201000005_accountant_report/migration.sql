-- A11: Нягтланд өдрийн тайлан илгээх. Зөвхөн нэмэлт.
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'ACCOUNTANT_REPORT';

CREATE TYPE "DispatchStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "ReportDispatch" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "recipients" TEXT[],
    "status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "sentById" TEXT,
    "summary" JSONB NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDispatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportDispatch_day_createdAt_idx" ON "ReportDispatch"("day", "createdAt");

ALTER TABLE "ReportDispatch" ADD CONSTRAINT "ReportDispatch_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
