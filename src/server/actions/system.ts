"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/session";
import { retryJob } from "@/server/modules/outbox/monitor";
import { runAction } from "./result";

export async function retryOutboxJobAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("settings:write");
    await retryJob(String(id), user.id);
    revalidatePath("/admin/system");
    revalidatePath("/admin");
  }, "Дахин дараалалд орлоо — worker удахгүй илгээнэ.");
}

export async function markLaunchedAction() {
  return runAction(async () => {
    const user = await requirePermission("settings:write");
    const { markLaunched } = await import("@/server/modules/system/readiness");
    await markLaunched(user.id);
    revalidatePath("/admin");
  }, "Нээлт хийгдсэн гэж тэмдэглэгдлээ. Seed болон туршилтын цэвэрлэгээ цаашид ажиллахгүй.");
}
