/**
 * ADMIN → Тохиргоо: салоны мэдээлэл (Branch + footer/холбоо барих), POS, имэйл, QPay.
 * Бүх өөрчлөлт AuditLog-д. Салоны мэдээлэл сайтын footer-т нөлөөлөх тул action updateTag("settings").
 */
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { FooterSetting } from "@/lib/site-settings";
import { mapsUrlSchema, phoneSchema } from "@/lib/validation/site-settings";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { qpayEnvConfigured } from "@/server/modules/payments/providers/qpay";
import { CHECKOUT_AVAILABLE, SHOP_MODES, emailSettingsSchema, posSettingsSchema, shopSettingsSchema, type ShopMode } from "./schema";

const optionalHttps = (host: RegExp, message: string) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((v) => {
      if (!v) return true;
      try {
        const u = new URL(v);
        return u.protocol === "https:" && host.test(u.hostname);
      } catch {
        return false;
      }
    }, message);

export const salonSchema = z.object({
  name: z.string().trim().min(2, "Салоны нэрийг оруулна уу.").max(80),
  address: z.string().trim().min(5, "Хаягаа оруулна уу.").max(300),
  phone: phoneSchema,
  email: z.string().trim().pipe(z.email("Имэйл хаяг буруу байна.")),
  instagram: optionalHttps(/(^|\.)instagram\.com$/, "https://instagram.com/… хэлбэрээр."),
  facebook: optionalHttps(/(^|\.)facebook\.com$|(^|\.)fb\.com$/, "https://facebook.com/… хэлбэрээр."),
  mapsUrl: mapsUrlSchema,
});
export type SalonInput = z.input<typeof salonSchema>;

const EMPTY_FOOTER: FooterSetting = {
  columns: [],
  contact: { title: "Холбоо барих", address: "", phone: "", email: "", hours: [] },
  socials: [],
  newsletter: { title: "", text: "", placeholder: "", button: "" },
  copyright: "",
};

export async function getSalonSettings() {
  const [branch, row] = await Promise.all([getCurrentBranch(), db.siteSetting.findUnique({ where: { key: "footer" } })]);
  const footer = (row?.value as FooterSetting | undefined) ?? EMPTY_FOOTER;
  const social = (n: "instagram" | "facebook") => footer.socials?.find((s) => s.network === n)?.href ?? "";
  return {
    name: branch.name,
    address: footer.contact?.address || branch.address || "",
    phone: footer.contact?.phone || branch.phone || "",
    email: footer.contact?.email ?? "",
    instagram: social("instagram"),
    facebook: social("facebook"),
    mapsUrl: footer.contact?.mapsUrl ?? "",
  };
}

/** Branch (имэйл, баримт) ба footer/холбоо барих хуудсыг нэг дор шинэчилнэ */
export async function saveSalonSettings(raw: SalonInput, actorId: string) {
  const d = salonSchema.parse(raw);
  const branch = await getCurrentBranch();
  return db.$transaction(async (tx) => {
    const row = await tx.siteSetting.findUnique({ where: { key: "footer" } });
    const footer = (row?.value as FooterSetting | undefined) ?? EMPTY_FOOTER;
    const socials = (["instagram", "facebook"] as const)
      .map((network) => ({ network, href: network === "instagram" ? d.instagram : d.facebook, label: network === "instagram" ? "Instagram" : "Facebook" }))
      .filter((s) => s.href);
    const next: FooterSetting = {
      ...footer,
      contact: { ...footer.contact, address: d.address, phone: d.phone, email: d.email, mapsUrl: d.mapsUrl },
      socials,
    };
    await tx.branch.update({ where: { id: branch.id }, data: { name: d.name, address: d.address, phone: d.phone } });
    await tx.siteSetting.upsert({ where: { key: "footer" }, create: { key: "footer", value: next as Prisma.InputJsonValue }, update: { value: next as Prisma.InputJsonValue } });
    await audit(tx, {
      userId: actorId,
      action: "settings.salon",
      entity: "Branch",
      entityId: branch.id,
      before: { name: branch.name, address: branch.address, phone: branch.phone, contact: footer.contact, socials: footer.socials },
      after: d,
    });
  });
}

async function saveJsonSetting(key: string, value: Prisma.InputJsonValue, actorId: string, action: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.siteSetting.findUnique({ where: { key } });
    await tx.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
    await audit(tx, { userId: actorId, action, entity: "SiteSetting", entityId: key, before: before?.value, after: value });
  });
}

export const posFormSchema = z.object({
  maxManagerDiscountPercent: z.number({ error: "Тоо оруулна уу." }).min(0).max(100, "100-аас ихгүй."),
  shiftDifferenceThreshold: z.number({ error: "Тоо оруулна уу." }).int().min(0).max(10_000_000),
  staleLockMinutes: z.number({ error: "Тоо оруулна уу." }).int().min(5, "5-аас багагүй.").max(1440),
  cashShiftsEnabled: z.boolean().optional(),
});

export async function savePosSettings(raw: z.input<typeof posFormSchema>, actorId: string) {
  const d = posFormSchema.parse(raw);
  const row = await db.siteSetting.findUnique({ where: { key: "pos" } });
  const next = posSettingsSchema.parse({ ...((row?.value as object) ?? {}), ...d });
  await saveJsonSetting("pos", next, actorId, "settings.pos");
}

const emailAddress = z.string().trim().max(200).refine((v) => !v || z.email().safeParse(v).success, "Имэйл хаяг буруу байна.");
export const emailFormSchema = z.object({ fromName: z.string().trim().max(80), fromAddress: emailAddress, replyTo: emailAddress });

export async function saveEmailSettings(raw: z.input<typeof emailFormSchema>, actorId: string) {
  const d = emailFormSchema.parse(raw);
  await saveJsonSetting("email", emailSettingsSchema.parse(d), actorId, "settings.email");
}

export async function saveQPayMode(mode: "manual" | "api", actorId: string) {
  const m = z.enum(["manual", "api"]).parse(mode);
  if (m === "api" && !qpayEnvConfigured()) {
    throw new UserError("QPay API-ийн түлхүүрүүд (QPAY_*) серверт тохируулагдаагүй тул API горимыг сонгох боломжгүй.");
  }
  await saveJsonSetting("qpay", { mode: m }, actorId, "settings.qpay");
}

export async function getShopMode(): Promise<ShopMode> {
  const row = await db.siteSetting.findUnique({ where: { key: "shop" } });
  return shopSettingsSchema.parse(row?.value ?? {}).mode;
}

/** Дэлгүүрийн горим. CHECKOUT (онлайн төлбөр, хүргэлт) одоогоор бэлэн биш — сонгох боломжгүй. */
export async function saveShopMode(mode: ShopMode, actorId: string) {
  const m = z.enum(SHOP_MODES).parse(mode);
  if (m === "CHECKOUT" && !CHECKOUT_AVAILABLE) throw new UserError("Онлайн худалдааны горим удахгүй нээгдэнэ.");
  await saveJsonSetting("shop", { mode: m }, actorId, "settings.shop");
}
