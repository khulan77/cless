import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL тохируулагдаагүй байна");
  // Session TimeZone = UTC заавал: adapter-pg нь timestamptz утгыг offset-гүй илгээдэг тул
  // DB-ийн default TimeZone (жишээ нь локал brew Postgres — Asia/Ulaanbaatar) дээр 8 цагаар
  // шилжиж хадгалагдана. Supabase UTC тул тэнд нөлөөгүй ч энд нэг мөр баталгаажуулна.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, options: "-c TimeZone=UTC" }) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
