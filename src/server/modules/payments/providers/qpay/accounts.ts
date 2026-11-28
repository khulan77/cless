/**
 * PROMPT 29: QPay дансны сонголт — цэвэр логик (DB-гүй).
 * Сонгож болох = тохиргоонд идэвхтэй БА (ENV түлхүүр бүрэн ЭСВЭЛ A данс гар горимд — хуучин терминалын урсгал).
 * Түлхүүргүй B данс — «Тохируулаагүй», сонгох боломжгүй.
 */
import type { QPaySettings } from "@/server/modules/settings/schema";
import { QPAY_ACCOUNTS, type QPayAccountKey, type QPayMode } from "./index";

export type QPayAccountView = { key: QPayAccountKey; label: string; enabled: boolean; configured: boolean; selectable: boolean };

export function qpayAccountViews(settings: Pick<QPaySettings, "accounts">, mode: QPayMode, configured: (a: QPayAccountKey) => boolean): QPayAccountView[] {
  return QPAY_ACCOUNTS.map((key) => {
    const s = settings.accounts[key];
    const isConfigured = configured(key);
    return { key, label: s.label, enabled: s.enabled, configured: isConfigured, selectable: s.enabled && (isConfigured || (key === "A" && mode === "manual")) };
  });
}

/** Анхдагч данс: тохиргооны анхдагч сонгогдох боломжтой бол тэр, үгүй бол эхний сонгогдох данс */
export function defaultQPayAccount(views: QPayAccountView[], preferred: QPayAccountKey): QPayAccountKey | null {
  return views.find((v) => v.key === preferred && v.selectable)?.key ?? views.find((v) => v.selectable)?.key ?? null;
}

/** Төлбөрийн данс: сонгоогүй бол анхдагч; сонгосон данс сонгогдох боломжгүй бол алдаа (null) */
export function resolveQPayAccount(views: QPayAccountView[], preferred: QPayAccountKey, requested?: QPayAccountKey | null): QPayAccountKey | null {
  if (!requested) return defaultQPayAccount(views, preferred);
  return views.find((v) => v.key === requested)?.selectable ? requested : null;
}

/** "QPay · Компанийн данс" — баримт, тайлан */
export const qpayAccountLabel = (settings: Pick<QPaySettings, "accounts">, acct: QPayAccountKey | null | undefined) => settings.accounts[acct ?? "A"].label;
