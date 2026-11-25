"use server";

/** "Нягтланд илгээх" (A11): хаяг тохируулах, илгээх. ADMIN / MANAGER (report:send). */
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/session";
import {
  accountantEmailsSchema,
  dailySummary,
  getAccountantEmails,
  headline,
  listDispatches,
  requestAccountantSend,
  saveAccountantEmails,
  sendSchema,
  summaryLines,
} from "@/server/modules/reports/accountant";
import { parseInput, runAction } from "./result";

export async function saveAccountantEmailsAction(input: { emails: string[] }) {
  return runAction(async () => {
    const user = await requirePermission("report:send");
    const emails = await saveAccountantEmails(parseInput(accountantEmailsSchema, input), user.id);
    revalidatePath("/admin/settings/accountant");
    return emails;
  }, "Нягтлангийн имэйл хадгалагдлаа.");
}

export async function sendToAccountantAction(input: { day: string; resend?: boolean }) {
  return runAction(async () => {
    const user = await requirePermission("report:send");
    const r = await requestAccountantSend(parseInput(sendSchema, input), user.id);
    if (r.status === "queued") revalidatePath("/admin/settings/accountant");
    return r;
  });
}

/** Баталгаажуулах цонхны урьдчилсан харагдац: тухайн өдрийн дүн, хүлээн авагчид, сүүлийн илгээлт */
export async function previewAccountantAction(day: string) {
  return runAction(async () => {
    await requirePermission("report:send");
    const { day: d } = parseInput(sendSchema, { day });
    const [full, recipients, [last]] = await Promise.all([
      dailySummary(d),
      getAccountantEmails(),
      listDispatches({ day: d, take: 1 }),
    ]);
    return {
      day: d,
      recipients,
      lines: summaryLines(headline(full)),
      last: last ? { status: last.status, at: last.sentAt ?? last.createdAt, by: last.sentBy?.name ?? null, error: last.error } : null,
    };
  });
}
