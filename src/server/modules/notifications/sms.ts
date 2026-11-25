/**
 * SMS (PROMPT 15): WeSend; түлхүүргүй (dev/test) бол `.emails/sms-<id>.txt` файл руу бичнэ — гадагш илгээхгүй.
 * Утасны дугаарыг log-д маскаар л (MessageLog).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { emailDir } from "./mailer";
import { logMessage } from "./log";
import * as wesend from "./providers/wesend";

export type SmsMessage = { to: string; text: string; id: string; kind?: string };

export async function sendSms(m: SmsMessage): Promise<{ provider: "wesend" | "file"; ref: string }> {
  const kind = m.kind ?? "sms";
  if (wesend.wesendConfigured()) {
    try {
      const r = await wesend.sendSms({ to: m.to, text: m.text, idempotencyKey: m.id.slice(0, 255) });
      await logMessage({ channel: "SMS", kind, to: m.to, status: "SENT", providerId: r.id, sandbox: r.sandbox });
      return { provider: "wesend", ref: r.id };
    } catch (e) {
      await logMessage({ channel: "SMS", kind, to: m.to, status: "FAILED", error: wesend.describeError(e) });
      wesend.logWeSendError("sms.send", e);
      throw new Error(`WeSend: ${wesend.wesendMessage(e)}`);
    }
  }
  const dir = emailDir();
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `sms-${m.id.replace(/[^\w.-]/g, "_")}.txt`);
  await writeFile(file, `to: ${m.to}\n\n${m.text}\n`, "utf8");
  await logMessage({ channel: "SMS", kind, to: m.to, status: "SENT", providerId: `file:${path.basename(file)}`, sandbox: true });
  return { provider: "file", ref: file };
}
