import Link from "next/link";
import { EmailSettingsForm, PosSettingsForm, QPayModeForm, SalonForm } from "@/components/admin/settings/SettingsForms";
import { Card, PageHeader } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateTime } from "@/lib/time";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { QPAY_TOKEN_HEARTBEAT, effectiveQPayMode, qpayEnvConfigured } from "@/server/modules/payments/providers/qpay";
import { getSalonSettings } from "@/server/modules/settings/admin-settings";
import { getEmailSettings, getPosSettings, getQPaySettings } from "@/server/modules/settings/pos-settings";

export const metadata = { title: "Тохиргоо" };
export const instant = false;

const s = t.admin.settingsPage;
const TABS = ["salon", "pos", "email", "qpay"] as const;
type Tab = (typeof TABS)[number];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePagePermission("settings:write");
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.find((x) => x === raw) ?? "salon";

  let body: React.ReactNode;
  if (tab === "salon") {
    body = <SalonForm initial={await getSalonSettings()} />;
  } else if (tab === "pos") {
    const pos = await getPosSettings();
    body = <PosSettingsForm initial={{ maxManagerDiscountPercent: pos.maxManagerDiscountPercent, shiftDifferenceThreshold: pos.shiftDifferenceThreshold, staleLockMinutes: pos.staleLockMinutes }} />;
  } else if (tab === "email") {
    body = <EmailSettingsForm initial={await getEmailSettings()} envFrom={process.env.EMAIL_FROM ?? ""} />;
  } else {
    const [q, token] = await Promise.all([getQPaySettings(), db.workerHeartbeat.findUnique({ where: { id: QPAY_TOKEN_HEARTBEAT } })]);
    body = (
      <div className="space-y-4">
        <QPayModeForm mode={q.mode} apiAvailable={qpayEnvConfigured()} />
        <div className="rounded-md bg-navy/[0.04] px-3 py-2 text-[13px] text-navy/70">
          <p>{s.qpayEffective(effectiveQPayMode(q.mode) === "api" ? "API" : "Гараар")}</p>
          <p>{token ? s.qpayLastToken(formatDateTime(token.lastRunAt)) : s.qpayNeverToken}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Тохиргоо" description="Салоны мэдээлэл, POS, имэйл, QPay" />
      <nav aria-label="Тохиргоо" className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((k) => (
          <Link
            key={k}
            href={`/admin/settings?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-[14px] ${tab === k ? "border-navy font-medium" : "border-transparent text-navy/60 hover:text-navy"}`}
          >
            {s.tabs[k]}
          </Link>
        ))}
      </nav>
      <Card>{body}</Card>
    </>
  );
}
