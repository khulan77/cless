/**
 * Имэйл илгээгч (PROMPT 15): WeSend (WESEND_API_KEY) → [хуучирсан] Resend (RESEND_API_KEY + EMAIL_FROM) →
 * dev/test-д `.emails/<id>.html` файл (гадагш юу ч илгээхгүй).
 *
 * WeSend хавсралт дэмждэггүй: хавсралттай имэйл WeSend-ээр явбал хавсралтгүй илгээгдэнэ (`attachmentsDropped`),
 * тиймээс илгээгч нь агуулгад татах холбоос өгнө (нягтлангийн тайлан).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { getEmailSettings } from "@/server/modules/settings/pos-settings";
import { logMessage } from "./log";
import * as wesend from "./providers/wesend";

export type Attachment = { filename: string; content: Uint8Array; contentType?: string };
/** `to` — нэг хаяг эсвэл жагсаалт (нягтлангийн тайлан олон хүлээн авагчтай) */
export type OutgoingEmail = { id: string; to: string | string[]; subject: string; html: string; text: string; attachments?: Attachment[]; kind?: string };
export type SendResult = { provider: "wesend" | "resend" | "file"; ref: string; attachmentsDropped?: boolean };

let client: Resend | null = null;

export function emailDir() {
  return process.env.EMAIL_FILE_DIR ?? path.join(process.cwd(), ".emails");
}

/** Хавсралт дамжуулах боломжтой эсэх (илгээхээс өмнө агуулгаа тохируулахад) */
export function emailSupportsAttachments() {
  return !wesend.wesendConfigured();
}

/** Илгээгч: админы тохиргоо (Тохиргоо → Имэйл) эсвэл EMAIL_FROM env */
export function resolveSender(settings: { fromName: string; fromAddress: string; replyTo: string }, envFrom: string | undefined) {
  const from = settings.fromAddress ? (settings.fromName ? `${settings.fromName.replace(/[<>"]/g, "")} <${settings.fromAddress}>` : settings.fromAddress) : envFrom;
  return { from, replyTo: settings.replyTo || undefined };
}

export async function sendEmail(mail: OutgoingEmail): Promise<SendResult> {
  const kind = mail.kind ?? "email";
  const recipients = Array.isArray(mail.to) ? mail.to : [mail.to];
  const settings = await getEmailSettings().catch(() => ({ fromName: "", fromAddress: "", replyTo: "" }));

  if (wesend.wesendConfigured()) {
    const refs: string[] = [];
    for (const [i, to] of recipients.entries()) {
      try {
        // Давтан оролдлогод давхар илгээхгүй (WeSend Idempotency-Key)
        const r = await wesend.sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text, replyTo: settings.replyTo || undefined, idempotencyKey: `${mail.id}:${i}`.slice(0, 255) });
        refs.push(r.id);
        await logMessage({ channel: "EMAIL", kind, to, status: "SENT", providerId: r.id, sandbox: r.sandbox });
      } catch (e) {
        await logMessage({ channel: "EMAIL", kind, to, status: "FAILED", error: wesend.wesendMessage(e) });
        throw new Error(`WeSend: ${wesend.wesendMessage(e)}`);
      }
    }
    return { provider: "wesend", ref: refs.join(","), attachmentsDropped: Boolean(mail.attachments?.length) };
  }

  // Хуучирсан: Resend (WESEND_API_KEY тохируулаагүй үед л)
  const key = process.env.RESEND_API_KEY;
  const { from, replyTo } = resolveSender(settings, process.env.EMAIL_FROM);
  if (key && from) {
    client ??= new Resend(key);
    const { data, error } = await client.emails.send(
      {
        from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(replyTo ? { replyTo } : {}),
        ...(mail.attachments?.length
          ? { attachments: mail.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: a.contentType })) }
          : {}),
      },
      { idempotencyKey: mail.id },
    );
    if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
    for (const to of recipients) await logMessage({ channel: "EMAIL", kind, to, status: "SENT", providerId: data?.id ?? null });
    return { provider: "resend", ref: data?.id ?? "" };
  }

  const dir = emailDir();
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${mail.id.replace(/[^\w.-]/g, "_")}.html`);
  const header = `<!-- to: ${recipients.join(", ").replace(/--/g, "")} | subject: ${mail.subject.replace(/--/g, "")} -->\n`;
  await writeFile(file, header + mail.html, "utf8");
  // Хавсралт: <id>__<filename> (dev-д нээж шалгахад)
  for (const a of mail.attachments ?? []) await writeFile(`${file.slice(0, -5)}__${a.filename.replace(/[^\w.-]/g, "_")}`, a.content);
  for (const to of recipients) await logMessage({ channel: "EMAIL", kind, to, status: "SENT", providerId: `file:${path.basename(file)}`, sandbox: true });
  return { provider: "file", ref: file };
}
