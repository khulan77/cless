"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Input, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { saveEmailSettingsAction, savePosSettingsAction, saveQPayModeAction, saveSalonAction, saveShopModeAction } from "@/server/actions/settings";

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
      <p className="text-[13px] text-navy/60 md:col-span-2">
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

export function PosSettingsForm({ initial }: { initial: { maxManagerDiscountPercent: number; shiftDifferenceThreshold: number; staleLockMinutes: number } }) {
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
        <legend className="mb-1 text-[13px] font-medium text-navy/80">{s.qpayMode}</legend>
        {(["manual", "api"] as const).map((m) => (
          <label key={m} className={`flex items-start gap-2 text-[14px] ${m === "api" && !apiAvailable ? "text-navy/45" : ""}`}>
            <input type="radio" name="qpay-mode" value={m} checked={v === m} disabled={m === "api" && !apiAvailable} onChange={() => setV(m)} className="mt-1 accent-navy" />
            <span>{m === "manual" ? s.qpayManual : s.qpayApi}</span>
          </label>
        ))}
        {!apiAvailable && <p className="text-[12px] text-amber-800">{s.qpayApiDisabled}</p>}
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
        <legend className="mb-1 text-[13px] font-medium text-navy/80">{s.shopMode}</legend>
        {(["CATALOG", "CHECKOUT"] as const).map((m) => {
          const disabled = m === "CHECKOUT" && !checkoutAvailable;
          return (
            <label key={m} className={`flex items-start gap-2 text-[14px] ${disabled ? "text-navy/45" : ""}`}>
              <input type="radio" name="shop-mode" value={m} checked={v === m} disabled={disabled} onChange={() => setV(m)} className="mt-1 accent-navy" />
              <span>
                {s.shopModes[m]}
                {disabled && <span className="ml-2 rounded bg-navy/10 px-1.5 py-0.5 text-[11px]">{s.soon}</span>}
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
