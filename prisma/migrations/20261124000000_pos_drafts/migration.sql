-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "draftData" JSONB;

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "info" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sale_createdById_status_updatedAt_idx" ON "Sale"("createdById", "status", "updatedAt");

