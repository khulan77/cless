"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button, Checkbox, Field, Input, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { saveEmailSettingsAction, savePosSettingsAction, saveQPayAccountsAction, saveQPayModeAction, saveSalonAction, saveShopModeAction } from "@/server/actions/settings";

const s = t.admin.settingsPage;

export type SalonValue = { name: string; address: string; phone: string; email: string; instagram: string; facebook: string; mapsUrl: string };

export function SalonForm({ initial }: { initial: SalonValue }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const a = useServerAction(saveSalonAction);
  const fe = a.fieldErrors;
  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run(v, { onSuccess: () => router.refresh() });
      }}
    >
      <Field label={s.name} htmlFor="st-name" hint={s.nameHint} error={fe.name}>
        <Input id="st-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      <Field label={s.phone} htmlFor="st-phone" error={fe.phone}>
        <Input id="st-phone" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      </Field>
      <Field label={s.address} htmlFor="st-address" error={fe.address} className="md:col-span-2">
        <Textarea id="st-address" className="min-h-16" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
      </Field>
      <Field label={s.email} htmlFor="st-email" error={fe.email}>
        <Input id="st-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      </Field>
      <Field label={s.mapsUrl} htmlFor="st-maps" hint={s.mapsHint} error={fe.mapsUrl}>
        <Input id="st-maps" value={v.mapsUrl} onChange={(e) => setV({ ...v, mapsUrl: e.target.value })} placeholder="https://maps.app.goo.gl/…" />
      </Field>
      <Field label={s.instagram} htmlFor="st-ig" error={fe.instagram}>
        <Input id="st-ig" value={v.instagram} onChange={(e) => setV({ ...v, instagram: e.target.value })} placeholder="https://instagram.com/…" />
      </Field>
      <Field label={s.facebook} htmlFor="st-fb" error={fe.facebook}>
        <Input id="st-fb" value={v.facebook} onChange={(e) => setV({ ...v, facebook: e.target.value })} placeholder="https://facebook.com/…" />
      </Field>
      <p className="text-[13px] text-ink-soft md:col-span-2">
        {s.hoursNote}{" "}
        <Link href="/admin/staff-schedules" className="underline">
          {s.hoursLink}
        </Link>
      </p>
      <div className="md:col-span-2">
        <Button type="submit" disabled={a.pending}>
          {s.save}
        </Button>
      </div>
    </form>
  );
}

export function PosSettingsForm({ initial }: { initial: { maxManagerDiscountPercent: number; shiftDifferenceThreshold: number; staleLockMinutes: number; cashShiftsEnabled: boolean } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const a = useServerAction(savePosSettingsAction);
  const fe = a.fieldErrors;
  return (
    <form
      className="grid gap-4 md:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run(v, { onSuccess: () => router.refresh() });
      }}
    >
      <Field label={s.maxDiscount} htmlFor="st-disc" hint={s.maxDiscountHint} error={fe.maxManagerDiscountPercent}>
        <Input id="st-disc" type="number" min={0} max={100} step={1} value={v.maxManagerDiscountPercent} onChange={(e) => setV({ ...v, maxManagerDiscountPercent: Number(e.target.value) })} />
      </Field>
      <Field label={s.shiftThreshold} htmlFor="st-shift" hint={s.shiftThresholdHint} error={fe.shiftDifferenceThreshold}>
        <MoneyInput id="st-shift" className="w-full" value={v.shiftDifferenceThreshold} onChange={(n) => setV({ ...v, shiftDifferenceThreshold: n })} />
      </Field>
      <Field label={s.staleLock} htmlFor="st-stale" error={fe.staleLockMinutes}>
        <Input id="st-stale" type="number" min={5} max={1440} step={5} value={v.staleLockMinutes} onChange={(e) => setV({ ...v, staleLockMinutes: Number(e.target.value) })} />
      </Field>
      <div className="md:col-span-3">
        <Checkbox
          label="Кассын ээлж ашиглах (нээх / хаах, бэлэн мөнгө тоолох)"
          checked={v.cashShiftsEnabled}
          onChange={(e) => setV({ ...v, cashShiftsEnabled: e.target.checked })}
        />
        <p className="mt-1 text-[13px] text-ink-soft">
          Унтраалттай (анхдагч): менежер бүр өөрийн бүртгэлээр зэрэг борлуулалт бичнэ, бэлэн төлбөрт ээлж шаардахгүй. Тооцоо — «Өдрийн касс» тайлан.
        </p>
      </div>
      <div className="md:col-span-3">
        <Button type="submit" disabled={a.pending}>
          {s.save}
        </Button>
      </div>
    </form>
  );
}

export function EmailSettingsForm({ initial, envFrom }: { initial: { fromName: string; fromAddress: string; replyTo: string }; envFrom: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const a = useServerAction(saveEmailSettingsAction);
  const fe = a.fieldErrors;
  return (
    <form
      className="grid gap-4 md:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run(v, { onSuccess: () => router.refresh() });
      }}
    >
      <Field label={s.fromName} htmlFor="st-fromname" error={fe.fromName}>
        <Input id="st-fromname" value={v.fromName} onChange={(e) => setV({ ...v, fromName: e.target.value })} />
      </Field>
      <Field label={s.fromAddress} htmlFor="st-from" hint={s.fromAddressHint(envFrom || "—")} error={fe.fromAddress}>
        <Input id="st-from" type="email" value={v.fromAddress} onChange={(e) => setV({ ...v, fromAddress: e.target.value })} />
      </Field>
      <Field label={s.replyTo} htmlFor="st-reply" error={fe.replyTo}>
        <Input id="st-reply" type="email" value={v.replyTo} onChange={(e) => setV({ ...v, replyTo: e.target.value })} />
      </Field>
      <div className="md:col-span-3">
        <Button type="submit" disabled={a.pending}>
          {s.save}
        </Button>
      </div>
    </form>
  );
}

export function QPayModeForm({ mode, apiAvailable }: { mode: "manual" | "api"; apiAvailable: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(mode);
  const a = useServerAction(saveQPayModeAction);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run(v, { onSuccess: () => router.refresh() });
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-[13px] font-medium text-ink">{s.qpayMode}</legend>
        {(["manual", "api"] as const).map((m) => (
          <label key={m} className={`flex items-start gap-2 text-[14px] ${m === "api" && !apiAvailable ? "text-ink-faint" : ""}`}>
            <input type="radio" name="qpay-mode" value={m} checked={v === m} disabled={m === "api" && !apiAvailable} onChange={() => setV(m)} className="mt-1 accent-navy" />
            <span>{m === "manual" ? s.qpayManual : s.qpayApi}</span>
          </label>
        ))}
        {!apiAvailable && <p className="text-[13px] text-warn">{s.qpayApiDisabled}</p>}
      </fieldset>
      <Button type="submit" disabled={a.pending || v === mode}>
        {s.save}
      </Button>
    </form>
  );
}

export function ShopModeForm({ mode, checkoutAvailable }: { mode: "CATALOG" | "CHECKOUT"; checkoutAvailable: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(mode);
  const a = useServerAction(saveShopModeAction);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run(v, { onSuccess: () => router.refresh() });
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-[13px] font-medium text-ink">{s.shopMode}</legend>
        {(["CATALOG", "CHECKOUT"] as const).map((m) => {
          const disabled = m === "CHECKOUT" && !checkoutAvailable;
          return (
            <label key={m} className={`flex items-start gap-2 text-[14px] ${disabled ? "text-ink-faint" : ""}`}>
              <input type="radio" name="shop-mode" value={m} checked={v === m} disabled={disabled} onChange={() => setV(m)} className="mt-1 accent-navy" />
              <span>
                {s.shopModes[m]}
                {disabled && <span className="ml-2 rounded bg-ink/[0.07] px-1.5 py-0.5 text-[13px]">{s.soon}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>
      <Button type="submit" disabled={a.pending}>
        {s.save}
      </Button>
    </form>
  );
}

/** PROMPT 29: хоёр QPay данс — харагдах нэр, идэвхтэй, касс дээрх анхдагч. Түлхүүр зөвхөн серверийн ENV-д. */
export type QPayAccountRow = { key: "A" | "B"; label: string; enabled: boolean; configured: boolean };
export function QPayAccountsForm({ accounts, defaultAccount }: { accounts: QPayAccountRow[]; defaultAccount: "A" | "B" }) {
  const router = useRouter();
  const [rows, setRows] = useState(accounts);
  const [def, setDef] = useState(defaultAccount);
  const a = useServerAction(saveQPayAccountsAction);
  const set = (key: "A" | "B", patch: Partial<QPayAccountRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const byKey = (k: "A" | "B") => rows.find((r) => r.key === k)!;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const acc = (k: "A" | "B") => ({ label: byKey(k).label, enabled: byKey(k).enabled });
        void a.run({ accounts: { A: acc("A"), B: acc("B") }, defaultAccount: def }, { onSuccess: () => router.refresh() });
      }}
    >
      <p className="text-[13px] font-medium text-ink">QPay данс</p>
      {rows.map((r) => {
        // B — түлхүүргүй бол сонгох боломжгүй; A — гар горимд түлхүүргүй ч ажилладаг (терминал)
        const locked = r.key === "B" && !r.configured;
        return (
          <div key={r.key} className="grid gap-3 rounded-xl border border-hairline p-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <Field label={`Данс ${r.key} — харагдах нэр`} htmlFor={`qpay-${r.key}-label`} error={a.fieldErrors?.[`accounts.${r.key}.label`]?.[0]}>
              <Input id={`qpay-${r.key}-label`} value={r.label} maxLength={40} onChange={(e) => set(r.key, { label: e.target.value })} />
            </Field>
            <div className="flex items-center gap-2 pb-2">
              {r.configured ? <Badge tone="green">Түлхүүртэй</Badge> : <Badge tone="amber">Тохируулаагүй</Badge>}
            </div>
            <div className="flex flex-col gap-1.5 pb-2 text-[14px]">
              <label className={`flex items-center gap-2 ${locked ? "text-ink-faint" : ""}`}>
                <input type="checkbox" className="accent-navy" checked={r.enabled && !locked} disabled={locked} onChange={(e) => set(r.key, { enabled: e.target.checked })} />
                Идэвхтэй
              </label>
              <label className={`flex items-center gap-2 ${!r.enabled || locked ? "text-ink-faint" : ""}`}>
                <input type="radio" name="qpay-default" className="accent-navy" checked={def === r.key} disabled={!r.enabled || locked} onChange={() => setDef(r.key)} />
                Касс дээр анхдагч
              </label>
            </div>
            {locked && <p className="text-[13px] text-warn md:col-span-3">QPAY_B_USERNAME, QPAY_B_PASSWORD, QPAY_B_INVOICE_CODE серверт тохируулсны дараа сонгох боломжтой.</p>}
          </div>
        );
      })}
      <p className="text-[13px] text-ink-soft">Данс нь зөвхөн мөнгө хүлээн авах газар — НӨАТ, eBarimt данснаас хамаарахгүй, борлуулалт бүр нэг системд бүртгэгдэнэ.</p>
      <Button type="submit" disabled={a.pending}>
        {s.save}
      </Button>
    </form>
  );
}
