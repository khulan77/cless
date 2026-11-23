"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { InquiryStatus } from "@/generated/prisma/client";
import { requirePermission } from "@/server/auth/session";
import { clientIp } from "@/server/auth/rate-limit";
import { inquirySchema, setInquiryStatus, submitInquiry, type InquiryInput } from "@/server/modules/inquiries/service";
import { parseInput, runAction } from "./result";

/** Public: storefront "Салонд захиалах" form (honeypot + per IP/phone rate limit in the service) */
export async function submitInquiryAction(input: InquiryInput) {
  return runAction(async () => {
    const data = parseInput(inquirySchema, input);
    const raw = clientIp(await headers());
    const ip = raw && raw !== "unknown" ? raw : null;
    return submitInquiry(data, { ip });
  });
}

export async function setInquiryStatusAction(input: { id: string; status: InquiryStatus }) {
  return runAction(async () => {
    const user = await requirePermission("inquiry:manage");
    await setInquiryStatus(input.id, input.status, user.id);
    revalidatePath("/admin/inquiries");
    revalidatePath("/admin");
  }, "Төлөв шинэчлэгдлээ.");
}
