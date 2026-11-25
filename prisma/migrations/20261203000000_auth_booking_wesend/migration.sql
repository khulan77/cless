-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "CustomerOrigin" AS ENUM ('ADMIN', 'ONLINE');

-- CreateEnum
CREATE TYPE "VerifyPurpose" AS ENUM ('STAFF_INVITE', 'STAFF_RESET', 'STAFF_PHONE', 'CUSTOMER_LOGIN', 'CUSTOMER_EMAIL');

-- CreateEnum
CREATE TYPE "VerifyStatus" AS ENUM ('PENDING', 'APPROVED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('SMS', 'EMAIL', 'VERIFY');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterEnum
ALTER TYPE "ApptSource" ADD VALUE 'ONLINE';

-- AlterEnum
ALTER TYPE "ApptStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "dataConsentAt" TIMESTAMP(3),
ADD COLUMN     "emailConsentAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "onlineRegisteredAt" TIMESTAMP(3),
ADD COLUMN     "onlineUnblockedAt" TIMESTAMP(3),
ADD COLUMN     "registeredVia" "CustomerOrigin" NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "invitedById" TEXT,
ADD COLUMN     "loginPhone" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "purpose" "VerifyPurpose" NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "targetHash" TEXT NOT NULL,
    "targetMask" TEXT NOT NULL,
    "providerId" TEXT,
    "codeHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "VerifyStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "customerId" TEXT,
    "ipHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "kind" TEXT NOT NULL,
    "toMask" TEXT NOT NULL,
    "providerId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerEmail" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "visitId" TEXT,
    "kind" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "sentById" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Verification_targetHash_createdAt_idx" ON "Verification"("targetHash", "createdAt");

-- CreateIndex
CREATE INDEX "Verification_ipHash_createdAt_idx" ON "Verification"("ipHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerSession_customerId_idx" ON "CustomerSession"("customerId");

-- CreateIndex
CREATE INDEX "MessageLog_createdAt_idx" ON "MessageLog"("createdAt");

-- CreateIndex
CREATE INDEX "CustomerEmail_customerId_createdAt_idx" ON "CustomerEmail"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_loginPhone_key" ON "User"("loginPhone");

-- AddForeignKey
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerEmail" ADD CONSTRAINT "CustomerEmail_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
