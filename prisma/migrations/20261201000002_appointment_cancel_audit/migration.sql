-- PROMPT 12 A6: цуцлалт — хэн, хэзээ, ямар ангиллаар. Зөвхөн нэмэлт; хуучин cancelReason хэвээр.
ALTER TABLE "Appointment" ADD COLUMN "cancelCategory" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "cancelledById" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "cancelledAt" TIMESTAMPTZ(3);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Appointment_cancelledAt_idx" ON "Appointment"("cancelledAt");
