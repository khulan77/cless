/**
 * POS / татвар / QPay тохиргоо (SiteSetting). Утга байхгүй эсвэл буруу бол default.
 * Next.js-ээс хамааралгүй — service-үүд transaction дотроос ч дуудна.
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import {
  bookingSettingsSchema,
  posSettingsSchema,
  qpaySettingsSchema,
  taxSettingsSchema,
  type BookingSettings,
  type PosSettings,
  type QPaySettings,
  type TaxSettings,
} from "./schema";

export type { BookingSettings, PosSettings, QPaySettings, TaxSettings };

type Client = Prisma.TransactionClient | typeof db;

async function read(client: Client, key: string): Promise<unknown> {
  const row = await client.siteSetting.findUnique({ where: { key }, select: { value: true } });
  return row?.value ?? {};
}

export async function getPosSettings(client: Client = db): Promise<PosSettings> {
  return posSettingsSchema.parse(await read(client, "pos"));
}

export async function getTaxSettings(client: Client = db): Promise<TaxSettings> {
  return taxSettingsSchema.parse(await read(client, "tax"));
}

export async function getQPaySettings(client: Client = db): Promise<QPaySettings> {
  return qpaySettingsSchema.parse(await read(client, "qpay"));
}

export async function getBookingSettings(client: Client = db): Promise<BookingSettings> {
  const parsed = bookingSettingsSchema.parse(await read(client, "booking"));
  // Хадгалагдсан утгад зарим гариг дутуу байвал амралтын өдөр гэж үзнэ
  for (const d of ["0", "1", "2", "3", "4", "5", "6"] as const) parsed.hours[d] ??= [];
  return parsed;
}
