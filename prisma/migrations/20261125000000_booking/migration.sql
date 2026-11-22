-- EXCLUDE USING gist-д "staffId"/"roomId" (text) = операторт шаардлагатай (init migration-д бий, давхар хамгаалалт)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "ApptSource" AS ENUM ('PHONE', 'INSTAGRAM', 'FACEBOOK', 'WALK_IN', 'OTHER');

-- CreateEnum
CREATE TYPE "TimeOffReason" AS ENUM ('VACATION', 'SICK', 'TRAINING', 'OTHER');

-- AlterEnum
ALTER TYPE "ApptStatus" ADD VALUE 'ARRIVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'APPT_EMAIL';
ALTER TYPE "JobType" ADD VALUE 'APPT_REMINDER';

-- AlterTable
-- blockedUntil: эхлээд nullable, одоо байгаа мөрүүдэд = endsAt, дараа нь NOT NULL
ALTER TABLE "Appointment" ADD COLUMN     "blockedUntil" TIMESTAMPTZ(3),
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "priceSnapshot" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roomId" TEXT,
ADD COLUMN     "source" "ApptSource" NOT NULL DEFAULT 'PHONE',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

UPDATE "Appointment" SET "blockedUntil" = "endsAt" WHERE "blockedUntil" IS NULL;
ALTER TABLE "Appointment" ALTER COLUMN "blockedUntil" SET NOT NULL;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "bookable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bufferMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requiresRoom" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isBookable" BOOLEAN NOT NULL DEFAULT false;
-- Одоо байгаа гоо сайханчид (STAFF) календарьт сонгогдоно
UPDATE "User" SET "isBookable" = true WHERE "role" = 'STAFF';

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSchedule" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTimeOff" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" "TimeOffReason" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceStaff" (
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,

    CONSTRAINT "ServiceStaff_pkey" PRIMARY KEY ("serviceId","staffId")
);

-- CreateIndex
CREATE INDEX "Room_branchId_isActive_sortOrder_idx" ON "Room"("branchId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "StaffSchedule_staffId_weekday_idx" ON "StaffSchedule"("staffId", "weekday");

-- CreateIndex
CREATE INDEX "StaffTimeOff_staffId_startsAt_idx" ON "StaffTimeOff"("staffId", "startsAt");

-- CreateIndex
CREATE INDEX "ServiceStaff_staffId_idx" ON "ServiceStaff"("staffId");

-- CreateIndex
CREATE INDEX "Appointment_branchId_startsAt_idx" ON "Appointment"("branchId", "startsAt");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaff" ADD CONSTRAINT "ServiceStaff_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaff" ADD CONSTRAINT "ServiceStaff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ───────────── Гараар нэмсэн constraint-ууд ─────────────

-- Хуучин давхцлын constraint (buffer-гүй) → blockedUntil дээрх шинэ constraint
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_no_staff_overlap";
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_time_order_check";

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_time_order_check" CHECK ("endsAt" > "startsAt" AND "blockedUntil" >= "endsAt");

-- Нэг ажилтанд идэвхтэй цаг (buffer-тэйгээ) давхцахгүй. [) — 10:00–11:00 ба 11:00–12:00 зөвшөөрөгдөнө.
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_no_staff_overlap"
  EXCLUDE USING gist (
    "staffId" WITH =,
    tstzrange("startsAt", "blockedUntil", '[)') WITH &&
  ) WHERE ("status" NOT IN ('CANCELLED', 'NO_SHOW'));

-- Нэг өрөөнд идэвхтэй цаг давхцахгүй (өрөөгүй цагт хамаарахгүй)
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_no_room_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("startsAt", "blockedUntil", '[)') WITH &&
  ) WHERE ("roomId" IS NOT NULL AND "status" NOT IN ('CANCELLED', 'NO_SHOW'));

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_price_nonneg_check" CHECK ("priceSnapshot" >= 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_buffer_nonneg_check" CHECK ("bufferMin" >= 0);

-- Нэг цагт идэвхтэй (ноорог / төлбөр хүлээж буй / хэсэгчлэн төлсөн) нэг л борлуулалт — DB баталгаажуулна
CREATE UNIQUE INDEX "Sale_one_active_per_appointment"
  ON "Sale" ("appointmentId")
  WHERE "appointmentId" IS NOT NULL AND "status" IN ('DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_PAID');

-- Ажлын цаг: 0=Ням..6=Бямба, "HH:MM", эхлэл < төгсгөл
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6);
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_time_check"
  CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "endTime" ~ '^([01][0-9]|2[0-4]):[0-5][0-9]$' AND "startTime" < "endTime");

ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_range_check" CHECK ("endsAt" > "startsAt");
