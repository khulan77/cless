import { notFound } from "next/navigation";
import { EmailSettingsForm, PosSettingsForm, QPayModeForm, SalonForm, ShopModeForm } from "@/components/admin/settings/SettingsForms";
import { Card, PageHeader } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateTime } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { QPAY_TOKEN_HEARTBEAT, effectiveQPayMode, qpayEnvConfigured } from "@/server/modules/payments/providers/qpay";
import { getSalonSettings, getShopMode } from "@/server/modules/settings/admin-settings";
import { CHECKOUT_AVAILABLE } from "@/server/modules/settings/schema";
import { getEmailSettings, getPosSettings, getQPaySettings } from "@/server/modules/settings/pos-settings";

export const instant = false;

const s = t.admin.settingsPage;
/** URL segment → settings topic */
const SECTIONS = { salon: "salon", shop: "shop", pos: "pos", email: "email", payments: "qpay" } as const;
type Topic = (typeof SECTIONS)[keyof typeof SECTIONS];

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const topic = SECTIONS[section as keyof typeof SECTIONS];
  return { title: topic ? s.tabs[topic] : t.admin.nav.settings };
}

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requirePagePermission("settings:write");
  const { section } = await params;
  const topic: Topic | undefined = SECTIONS[section as keyof typeof SECTIONS];
  if (!topic) notFound();

  let body: React.ReactNode;
  if (topic === "salon") {
    body = <SalonForm initial={await getSalonSettings()} />;
  } else if (topic === "shop") {
    body = <ShopModeForm mode={await getShopMode()} checkoutAvailable={CHECKOUT_AVAILABLE} />;
  } else if (topic === "pos") {
    const pos = await getPosSettings();
    body = <PosSettingsForm initial={{ maxManagerDiscountPercent: pos.maxManagerDiscountPercent, shiftDifferenceThreshold: pos.shiftDifferenceThreshold, staleLockMinutes: pos.staleLockMinutes }} />;
  } else if (topic === "email") {
    body = <EmailSettingsForm initial={await getEmailSettings()} envFrom={process.env.EMAIL_FROM ?? ""} />;
  } else {
    const [q, token] = await Promise.all([getQPaySettings(), db.workerHeartbeat.findUnique({ where: { id: QPAY_TOKEN_HEARTBEAT } })]);
    body = (
      <div className="space-y-5">
        <QPayModeForm mode={q.mode} apiAvailable={qpayEnvConfigured()} />
        <div className="rounded-xl bg-canvas px-4 py-3 text-[14px] text-ink-soft">
          <p>{s.qpayEffective(effectiveQPayMode(q.mode) === "api" ? "Автомат" : "Гараар")}</p>
          <p>{token ? s.qpayLastToken(formatDateTime(token.lastRunAt)) : s.qpayNeverToken}</p>
        </div>
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
