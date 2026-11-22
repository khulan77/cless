/**
 * Имэйл илгээгч. RESEND_API_KEY + EMAIL_FROM байвал Resend, үгүй бол (dev/test)
 * `.emails/<id>.html` файл руу бичнэ — гадагш юу ч илгээхгүй.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { getEmailSettings } from "@/server/modules/settings/pos-settings";

export type OutgoingEmail = { id: string; to: string; subject: string; html: string; text: string };
export type SendResult = { provider: "resend" | "file"; ref: string };

let client: Resend | null = null;

export function emailDir() {
  return process.env.EMAIL_FILE_DIR ?? path.join(process.cwd(), ".emails");
}

/** Илгээгч: админы тохиргоо (Тохиргоо → Имэйл) эсвэл EMAIL_FROM env */
export function resolveSender(settings: { fromName: string; fromAddress: string; replyTo: string }, envFrom: string | undefined) {
  const from = settings.fromAddress ? (settings.fromName ? `${settings.fromName.replace(/[<>"]/g, "")} <${settings.fromAddress}>` : settings.fromAddress) : envFrom;
  return { from, replyTo: settings.replyTo || undefined };
}

export async function sendEmail(mail: OutgoingEmail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const { from, replyTo } = resolveSender(await getEmailSettings().catch(() => ({ fromName: "", fromAddress: "", replyTo: "" })), process.env.EMAIL_FROM);
  if (key && from) {
    client ??= new Resend(key);
    const { data, error } = await client.emails.send(
      { from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, ...(replyTo ? { replyTo } : {}) },
      // Давтан оролдлогод давхар илгээхгүй
      { idempotencyKey: mail.id },
    );
    if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
    return { provider: "resend", ref: data?.id ?? "" };
  }
  const dir = emailDir();
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${mail.id.replace(/[^\w.-]/g, "_")}.html`);
  const header = `<!-- to: ${mail.to.replace(/--/g, "")} | subject: ${mail.subject.replace(/--/g, "")} -->\n`;
  await writeFile(file, header + mail.html, "utf8");
  return { provider: "file", ref: file };
}
