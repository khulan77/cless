/**
 * Айлчлалын өмнө/дараах зураг (A9).
 *
 * - Хадгалах: хувийн хавтас (storage/private.ts), public/ БИШ. Харах нь /api/media/visit/[id]-аар.
 * - Боловсруулалт: sharp — EXIF-ийн эргэлтийг хэрэглээд бүх metadata (байршил, төхөөрөмж) хасна,
 *   урт тал ≤ 2048px, webp.
 * - Эрх: харах/оруулах — ADMIN, MANAGER, тухайн үйлчлүүлэгчид үйлчилсэн STAFF (visit-photo:*).
 * - Зөвшөөрөл: үйлчлүүлэгчийн photoConsentAt хоосон бол оруулахдаа "зөвшөөрсөн" заавал; анх
 *   зөвшөөрөхөд огноо хадгалагдаж AuditLog-д бичигдэнэ.
 * - Log-д файлын агуулга, үйлчлүүлэгчийн мэдээлэл бичихгүй.
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { PhotoKind, Role } from "@/generated/prisma/enums";
import { audit } from "@/server/audit";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { privateStorage } from "@/server/storage/private";
import { canSeeCustomer } from "@/server/modules/customers/access";

type Actor = { id: string; role: Role };

export const PHOTO_MAX_INPUT_BYTES = 12 * 1024 * 1024;
export const PHOTO_MAX_SIDE = 2048;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"];

/** Зургийг үзэх эрх: visit-photo:read + үйлчлүүлэгчийг харах эрх (STAFF — үйлчилсэн) */
export async function canSeePhotosOf(actor: Actor, customerId: string) {
  return can(actor.role, "visit-photo:read") && (await canSeeCustomer(actor, customerId));
}

/** EXIF-ийн эргэлтийг хэрэглээд metadata-гүй, ≤2048px webp */
export async function processPhoto(input: Buffer) {
  const out = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: PHOTO_MAX_SIDE, height: PHOTO_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height };
}

export async function uploadVisitPhoto(
  input: { customerId: string; kind: PhotoKind; appointmentId?: string | null; visitId?: string | null; note?: string | null; consent: boolean; file: File },
  actor: Actor,
  now = new Date(),
) {
  if (!can(actor.role, "visit-photo:write")) throw new ForbiddenError();
  if (!(await canSeeCustomer(actor, input.customerId))) throw new ForbiddenError("Энэ үйлчлүүлэгчид та үйлчилж байгаагүй.");
  if (input.kind !== "BEFORE" && input.kind !== "AFTER") throw new UserError("Өмнө эсвэл дараа гэж сонгоно уу.");
  const f = input.file;
  if (!f || f.size === 0) throw new UserError("Зураг сонгоогүй байна.");
  if (f.size > PHOTO_MAX_INPUT_BYTES) throw new UserError("Зураг 12MB-аас ихгүй байх ёстой.");
  if (f.type && !ACCEPTED.includes(f.type)) throw new UserError("Зөвхөн зураг (JPG, PNG, WEBP, HEIC) оруулна.");

  const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { id: true, photoConsentAt: true } });
  if (!customer) throw new UserError("Үйлчлүүлэгч олдсонгүй.");
  if (!customer.photoConsentAt && !input.consent) throw new UserError("Үйлчлүүлэгч зураг авахыг зөвшөөрсөн эсэхийг тэмдэглэнэ үү.", { consent: ["Зөвшөөрөл заавал."] });
  // Цаг / айлчлал нь энэ үйлчлүүлэгчийнх байх ёстой
  if (input.appointmentId) {
    const a = await db.appointment.findUnique({ where: { id: input.appointmentId }, select: { customerId: true } });
    if (!a || a.customerId !== input.customerId) throw new UserError("Цаг олдсонгүй.");
  }
  if (input.visitId) {
    const v = await db.visit.findUnique({ where: { id: input.visitId }, select: { customerId: true } });
    if (!v || v.customerId !== input.customerId) throw new UserError("Айлчлал олдсонгүй.");
  }

  let processed: Awaited<ReturnType<typeof processPhoto>>;
  try {
    processed = await processPhoto(Buffer.from(await f.arrayBuffer()));
  } catch {
    throw new UserError("Зургийг уншиж чадсангүй. Өөр зураг оролдоно уу.");
  }
  const key = `visit-photos/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.webp`;
  await privateStorage.put(key, processed.data);
  try {
    return await db.$transaction(async (tx) => {
      if (!customer.photoConsentAt) {
        await tx.customer.update({ where: { id: customer.id }, data: { photoConsentAt: now } });
        await audit(tx, { userId: actor.id, action: "customer.photo_consent", entity: "Customer", entityId: customer.id, after: { photoConsentAt: now.toISOString() } });
      }
      const photo = await tx.visitPhoto.create({
        data: {
          customerId: input.customerId,
          appointmentId: input.appointmentId ?? null,
          visitId: input.visitId ?? null,
          kind: input.kind,
          storageKey: key,
          width: processed.width,
          height: processed.height,
          bytes: processed.data.length,
          note: input.note?.trim() ? input.note.trim().slice(0, 500) : null,
          createdById: actor.id,
        },
      });
      await audit(tx, { userId: actor.id, action: "visit_photo.create", entity: "VisitPhoto", entityId: photo.id, after: { customerId: input.customerId, kind: input.kind } });
      return photo;
    });
  } catch (e) {
    await privateStorage.remove(key);
    throw e;
  }
}

/** Устгах: оруулсан хүн 24 цагийн дотор, ADMIN/MANAGER (customer:write) хэзээ ч */
export async function deleteVisitPhoto(id: string, actor: Actor, now = new Date()) {
  if (!can(actor.role, "visit-photo:write")) throw new ForbiddenError();
  const photo = await db.visitPhoto.findUnique({ where: { id } });
  if (!photo) throw new UserError("Зураг олдсонгүй.");
  const own = photo.createdById === actor.id && now.getTime() - photo.createdAt.getTime() <= 24 * 3600_000;
  if (!own && !can(actor.role, "customer:write")) throw new ForbiddenError("Өөрийн оруулсан зургийг зөвхөн 24 цагийн дотор устгана.");
  await db.$transaction(async (tx) => {
    await tx.visitPhoto.delete({ where: { id } });
    await audit(tx, { userId: actor.id, action: "visit_photo.delete", entity: "VisitPhoto", entityId: id, before: { customerId: photo.customerId, kind: photo.kind } });
  });
  await privateStorage.remove(photo.storageKey);
}

/** Үйлчлүүлэгчийн зургууд — огноо/цагаар бүлэглэж, бүлэг бүрт өмнө ба дараа хажуу хажуудаа */
export async function photoGroups(customerId: string) {
  const photos = await db.visitPhoto.findMany({
    where: { customerId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      note: true,
      createdAt: true,
      createdById: true,
      appointmentId: true,
      visitId: true,
      createdBy: { select: { name: true } },
      appointment: { select: { startsAt: true, service: { select: { name: true } } } },
    },
  });
  const groups = new Map<string, { key: string; at: Date; title: string | null; before: typeof photos; after: typeof photos }>();
  for (const p of photos) {
    // Нэг цагийн зургууд нэг бүлэгт; цаггүй бол айлчлал, түүнгүй бол өдрөөр
    const key = p.appointmentId ?? p.visitId ?? `day:${p.createdAt.toISOString().slice(0, 10)}`;
    const g = groups.get(key) ?? { key, at: p.appointment?.startsAt ?? p.createdAt, title: p.appointment?.service.name ?? null, before: [], after: [] };
    (p.kind === "BEFORE" ? g.before : g.after).push(p);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** UI-д: бүлгүүд (сериалчилсан), устгах эрх, шинэ зургийг холбох цагууд (сүүлийн 7 хоног + өнөөдөр) */
export async function photoPanel(customerId: string, actor: Actor, now = new Date()) {
  const [groups, customer, appts] = await Promise.all([
    photoGroups(customerId),
    db.customer.findUnique({ where: { id: customerId }, select: { photoConsentAt: true } }),
    db.appointment.findMany({
      where: {
        customerId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startsAt: { gte: new Date(now.getTime() - 7 * 86_400_000), lt: new Date(now.getTime() + 86_400_000) },
        // STAFF — зөвхөн өөрийн цаг
        ...(can(actor.role, "customer:read") ? {} : { staffId: actor.id }),
      },
      orderBy: { startsAt: "desc" },
      select: { id: true, startsAt: true, service: { select: { name: true } } },
    }),
  ]);
  const view = (p: (typeof groups)[number]["before"][number]) => ({
    id: p.id,
    note: p.note,
    by: p.createdBy.name,
    canDelete: can(actor.role, "visit-photo:write") && (can(actor.role, "customer:write") || (p.createdById === actor.id && now.getTime() - p.createdAt.getTime() <= 24 * 3600_000)),
  });
  return {
    consented: Boolean(customer?.photoConsentAt),
    groups: groups.map((g) => ({
      key: g.key,
      at: g.at.toISOString(),
      title: g.title,
      appointmentId: g.before[0]?.appointmentId ?? g.after[0]?.appointmentId ?? null,
      visitId: g.before[0]?.visitId ?? g.after[0]?.visitId ?? null,
      before: g.before.map(view),
      after: g.after.map(view),
    })),
    targets: appts.map((a) => ({ appointmentId: a.id, startsAt: a.startsAt, service: a.service.name })),
  };
}
