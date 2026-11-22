"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Input, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { saveEmailSettingsAction, savePosSettingsAction, saveQPayModeAction, saveSalonAction } from "@/server/actions/settings";

const s = t.admin.settingsPage;

export type SalonValue = { name: string; address: string; phone: string; email: string; hours: string[]; instagram: string; facebook: string; mapsUrl: string };

export function SalonForm({ initial }: { initial: SalonValue }) {
  const router = useRouter();
  const [v, setV] = useState({ ...initial, hoursText: initial.hours.join("\n") });
  const a = useServerAction(saveSalonAction);
  const fe = a.fieldErrors;
  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const { hoursText, ...rest } = v;
        void a.run({ ...rest, hours: hoursText.split("\n") }, { onSuccess: () => router.refresh() });
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
      <Field label={s.hours} htmlFor="st-hours" hint={s.hoursHint} error={fe.hours} className="md:col-span-2">
        <Textarea id="st-hours" className="min-h-20" value={v.hoursText} onChange={(e) => setV({ ...v, hoursText: e.target.value })} />
      </Field>
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
