import { notFound } from "next/navigation";
import { EmailSettingsForm, PosSettingsForm, QPayAccountsForm, QPayModeForm, SalonForm, ShopModeForm } from "@/components/admin/settings/SettingsForms";
import { AccountantEmailsForm } from "@/components/admin/accountant/AccountantEmailsForm";
import { Badge, Card, PageHeader, Table, tdClass, thClass } from "@/components/admin/ui";
import { formatMNT } from "@/lib/money";
import { getAccountantEmails, listDispatches, type DailySummary } from "@/server/modules/reports/accountant";
import { t } from "@/i18n";
import { formatDateTime } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { QPAY_ACCOUNTS, effectiveQPayMode, qpayAccountConfigured, qpayEnvConfigured, qpayTokenHeartbeat } from "@/server/modules/payments/providers/qpay";
import { getSalonSettings, getShopMode } from "@/server/modules/settings/admin-settings";
import { CHECKOUT_AVAILABLE } from "@/server/modules/settings/schema";
import { getEmailSettings, getPosSettings, getQPaySettings } from "@/server/modules/settings/pos-settings";

export const instant = false;

const s = t.admin.settingsPage;
/** URL segment → settings topic */
const SECTIONS = { salon: "salon", shop: "shop", pos: "pos", email: "email", payments: "qpay", accountant: "accountant" } as const;
type Topic = (typeof SECTIONS)[keyof typeof SECTIONS];

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const topic = SECTIONS[section as keyof typeof SECTIONS];
  return { title: topic ? s.tabs[topic] : t.admin.nav.settings };
}

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const topic: Topic | undefined = SECTIONS[section as keyof typeof SECTIONS];
  if (!topic) notFound();
  // Төлбөрийн интеграц (QPay) — зөвхөн ADMIN; нягтлан — report:send; бусад тохиргоо — ADMIN, MANAGER
  await requirePagePermission(topic === "qpay" ? "integration:write" : topic === "accountant" ? "report:send" : "settings:write");

  let body: React.ReactNode;
  if (topic === "salon") {
    body = <SalonForm initial={await getSalonSettings()} />;
  } else if (topic === "shop") {
    body = <ShopModeForm mode={await getShopMode()} checkoutAvailable={CHECKOUT_AVAILABLE} />;
  } else if (topic === "pos") {
    const pos = await getPosSettings();
    body = <PosSettingsForm initial={{ maxManagerDiscountPercent: pos.maxManagerDiscountPercent, shiftDifferenceThreshold: pos.shiftDifferenceThreshold, staleLockMinutes: pos.staleLockMinutes, cashShiftsEnabled: pos.cashShiftsEnabled }} />;
  } else if (topic === "email") {
    body = <EmailSettingsForm initial={await getEmailSettings()} envFrom={process.env.EMAIL_FROM ?? ""} />;
  } else if (topic === "accountant") {
    const [emails, history] = await Promise.all([getAccountantEmails(), listDispatches({ take: 30 })]);
    const A = t.admin.accountant;
    return (
      <div className="max-w-[960px]">
        <PageHeader eyebrow={t.admin.nav.settings} title={s.tabs[topic]} description={s.intro[topic]} />
        <div className="max-w-[760px]">
          <Card>
            <AccountantEmailsForm initial={emails} />
          </Card>
        </div>
        <h2 className="mb-3 mt-8 font-display text-[22px] font-semibold">{A.history}</h2>
        {history.length === 0 ? (
          <p className="text-[14px] text-ink-soft">{A.historyEmpty}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>{A.day}</th>
                <th className={`${thClass} text-right`}>{A.total}</th>
                <th className={thClass}>{A.recipients}</th>
                <th className={thClass}>{A.sentBy}</th>
                <th className={thClass}>{A.when}</th>
                <th className={thClass}>{A.status}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className={`${tdClass} tabular-nums`}>{h.day}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatMNT((h.summary as unknown as DailySummary).total ?? 0)}</td>
                  <td className={`${tdClass} text-[13px]`}>{h.recipients.join(", ")}</td>
                  <td className={tdClass}>{h.sentBy?.name ?? "—"}</td>
                  <td className={`${tdClass} tabular-nums`}>{formatDateTime(h.sentAt ?? h.createdAt)}</td>
                  <td className={tdClass}>
                    <Badge tone={h.status === "SENT" ? "green" : h.status === "FAILED" ? "red" : "neutral"}>{A.statusLabel[h.status]}</Badge>
                    {h.error && h.status !== "SENT" && <span className="mt-1 block max-w-[260px] truncate text-[12px] text-danger" title={h.error}>{h.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    );
  } else {
    const [q, tokens] = await Promise.all([
      getQPaySettings(),
      db.workerHeartbeat.findMany({ where: { id: { in: QPAY_ACCOUNTS.map(qpayTokenHeartbeat) } } }),
    ]);
    body = (
      <div className="space-y-5">
        <QPayModeForm mode={q.mode} apiAvailable={qpayEnvConfigured()} />
        <div className="rounded-xl bg-canvas px-4 py-3 text-[14px] text-ink-soft">
          <p>{s.qpayEffective(effectiveQPayMode(q.mode) === "api" ? "Автомат" : "Гараар")}</p>
          {QPAY_ACCOUNTS.map((a) => {
            const token = tokens.find((x) => x.id === qpayTokenHeartbeat(a));
            return (
              <p key={a}>
                {q.accounts[a].label}: {token ? s.qpayLastToken(formatDateTime(token.lastRunAt)) : s.qpayNeverToken}
              </p>
            );
          })}
        </div>
        <QPayAccountsForm
          defaultAccount={q.defaultAccount}
          accounts={QPAY_ACCOUNTS.map((a) => ({ key: a, label: q.accounts[a].label, enabled: q.accounts[a].enabled, configured: qpayAccountConfigured(a) }))}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[760px]">
      <PageHeader eyebrow={t.admin.nav.settings} title={s.tabs[topic]} description={s.intro[topic]} />
      <Card>{body}</Card>
    </div>
  );
}
