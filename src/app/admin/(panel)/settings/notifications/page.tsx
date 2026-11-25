import { AutoVisitEmailToggle, TemplatesForm } from "@/components/admin/notify/NotifySettingsForms";
import { Badge, Card, PageHeader, Table, tdClass, thClass } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { recentMessages } from "@/server/modules/notifications/log";
import { getBalance, isSandboxKey, wesendConfigured, wesendMessage } from "@/server/modules/notifications/providers/wesend";
import { getNotifySettings } from "@/server/modules/notifications/settings";
import { DEFAULT_TEMPLATES, TEMPLATE_LABELS, getTemplates } from "@/server/modules/notifications/templates";
import { recentEvents } from "@/server/modules/notifications/webhook";

export const metadata = { title: "Мэдэгдэл" };
export const instant = false;

const CHANNEL: Record<string, string> = { SMS: "SMS", EMAIL: "Имэйл", VERIFY: "Код" };

export default async function NotificationsSettingsPage() {
  await requirePagePermission("settings:write");
  const configured = wesendConfigured();
  const [messages, settings, templates, balance, events] = await Promise.all([
    recentMessages(40),
    getNotifySettings(),
    getTemplates(),
    configured ? getBalance().then((b) => ({ ok: true as const, b })).catch((e: unknown) => ({ ok: false as const, error: wesendMessage(e) })) : null,
    recentEvents(),
  ]);
  const EVENT: Record<string, string> = { "balance.low": "Үлдэгдэл бага", "balance.empty": "Үлдэгдэл дууссан", "credits.expiring": "Кредит дуусах гэж байна", "domain.expiring": "Домэйн дуусах гэж байна", "domain.suspended": "Домэйн түдгэлзсэн", "webhook.test": "Туршилт" };
  return (
    <>
      <PageHeader eyebrow="Тохиргоо" title="Мэдэгдэл" description="WeSend (wesend.mn): SMS, имэйл, нэг удаагийн код. Брэнд нэр — CLÉSS." />
      <div className="max-w-[980px] space-y-5">
        <Card title="WeSend">
          <div className="flex flex-wrap items-center gap-3 text-[15px]">
            {configured ? <Badge tone="green">Холбогдсон</Badge> : <Badge tone="amber">Тохируулаагүй — dev горим (.emails/ руу бичнэ)</Badge>}
            {configured && isSandboxKey() && <Badge tone="info">Sandbox түлхүүр — юу ч илгээгдэхгүй</Badge>}
            {balance?.ok && <span>Үлдэгдэл: <strong className="tabular-nums">{balance.b.unlimited ? "Хязгааргүй" : balance.b.balance.toLocaleString("en-US")}</strong> кредит{balance.b.nextExpiry ? ` · ${balance.b.nextExpiry.credits} кредит ${balance.b.nextExpiry.expiresAt.slice(0, 10)}-нд дуусна` : ""}</span>}
            {balance && !balance.ok && <span className="text-err">{balance.error}</span>}
          </div>
          {events.length > 0 && (
            <ul className="mt-3 space-y-1 text-[13px]">
              {events.slice(0, 5).map((e) => (
                <li key={e.id}><span className="tabular-nums text-ink-soft">{e.createdAt.slice(0, 16).replace("T", " ")}</span> · {EVENT[e.type] ?? e.type}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[13px] text-ink-soft">Webhook: <code>/api/wesend/webhook</code> (WESEND_WEBHOOK_SECRET тохируулсан үед). WeSend нь үлдэгдэл, домэйны үйл явдал илгээдэг.</p>
          {!configured && <p className="mt-3 text-[13px] text-ink-soft">Сервер дээр WESEND_API_KEY орчны хувьсагчийг тохируулна (түлхүүрийг энд оруулахгүй).</p>}
        </Card>

        <Card title="Айлчлалын тайлан">
          <AutoVisitEmailToggle initial={settings.autoVisitEmail} />
        </Card>

        <TemplatesForm templates={templates} defaults={DEFAULT_TEMPLATES} labels={TEMPLATE_LABELS} />

        <Card title="Сүүлийн илгээлтүүд" description="Хүлээн авагчийг маскаар, агуулгагүй." flush>
          {messages.length === 0 ? (
            <p className="px-6 pb-6 text-[14px] text-ink-soft">Илгээлт алга.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={thClass}>Огноо</th>
                  <th className={thClass}>Суваг</th>
                  <th className={thClass}>Төрөл</th>
                  <th className={thClass}>Хүлээн авагч</th>
                  <th className={thClass}>Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{formatDateTime(m.createdAt)}</td>
                    <td className={tdClass}>{CHANNEL[m.channel]}</td>
                    <td className={`${tdClass} font-mono text-[12px]`}>{m.kind}</td>
                    <td className={`${tdClass} font-mono`}>{m.toMask}</td>
                    <td className={tdClass}>
                      <Badge tone={m.status === "SENT" ? "green" : m.status === "FAILED" ? "red" : "neutral"}>{m.status === "SENT" ? "Илгээсэн" : m.status === "FAILED" ? "Алдаа" : "Дараалалд"}</Badge>
                      {m.sandbox && <span className="ml-2 text-[12px] text-ink-soft">sandbox/dev</span>}
                      {m.error && <span className="block text-[12px] text-err">{m.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
