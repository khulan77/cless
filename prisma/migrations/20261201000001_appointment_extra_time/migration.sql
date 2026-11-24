-- PROMPT 12 A5: "Нэмэлт цаг" — өрөө бэлдэх, цэвэрлэх. blockedUntil = endsAt + bufferMin + extraMin
-- (давхцлын EXCLUDE constraint нь blockedUntil дээр тул өөрчлөлтгүй). Зөвхөн нэмэлт.
ALTER TABLE "Appointment" ADD COLUMN "extraMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_extra_min_check" CHECK ("extraMin" >= 0 AND "extraMin" <= 120);
