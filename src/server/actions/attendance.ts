"use server";

/**
 * "Ирлээ / Явлаа" (PROMPT 19) — өөрийн ирц, байршлаар. Эрх: attendance:self (бүх ажилтан).
 * Байршлыг зөвхөн товч дарсан мөчид клиентээс авна; цаг — серверийн.
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { clientIp } from "@/server/auth/rate-limit";
import { requirePermission } from "@/server/auth/session";
import { branchLocationSchema, saveBranchLocation } from "@/server/modules/attendance/branch-location";
import { myToday, punch } from "@/server/modules/attendance/service";
import { parseInput, runAction } from "./result";

const posSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100_000),
});

async function doPunch(type: "CHECK_IN" | "CHECK_OUT", input: z.input<typeof posSchema>) {
  const user = await requirePermission("attendance:self");
  const pos = parseInput(posSchema, input);
  const ip = clientIp(await headers());
  const r = await punch(type, user.id, pos, ip === "unknown" ? null : ip);
  revalidatePath("/admin/attendance");
  return { ...r, today: await myToday(user.id) };
}

export async function checkInAction(input: z.input<typeof posSchema>) {
  return runAction(async () => {
    await requirePermission("attendance:self");
    return doPunch("CHECK_IN", input);
  }, "Ирц бүртгэгдлээ — амжилттай ажиллаарай!");
}

export async function checkOutAction(input: z.input<typeof posSchema>) {
  return runAction(async () => {
    await requirePermission("attendance:self");
    return doPunch("CHECK_OUT", input);
  }, "Явсныг бүртгэлээ.");
}

/** Салбарын байршил (ирц) — settings:write */
export async function saveBranchLocationAction(input: z.input<typeof branchLocationSchema>) {
  return runAction(async () => {
    const user = await requirePermission("settings:write");
    await saveBranchLocation(parseInput(branchLocationSchema, input), user.id);
    revalidatePath("/admin/settings/attendance");
  }, "Байршил хадгалагдлаа.");
}
