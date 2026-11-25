"use client";

import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Card, Checkbox, Field, Input, Select } from "@/components/admin/ui";
import { saveOnlineBookingAction } from "@/server/actions/notify";
import type { OnlineBookingSettings } from "@/server/modules/online-booking/settings";

export function OnlineBookingForm({ initial, services }: { initial: OnlineBookingSettings; services: { id: string; name: string; category: string | null }[] }) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof OnlineBookingSettings>(k: K, val: OnlineBookingSettings[K]) => setV((x) => ({ ...x, [k]: val }));
  const { run, pending, fieldErrors } = useServerAction(saveOnlineBookingAction);
  const toggle = (id: string) => set("serviceIds", v.serviceIds.includes(id) ? v.serviceIds.filter((x) => x !== id) : [...v.serviceIds, id]);
  return (
    <form className="max-w-[880px] space-y-5" onSubmit={(e) => (e.preventDefault(), run(v))}>
      <Card title="Онлайн захиалга" description="Сайтаар үйлчлүүлэгч өөрөө цаг захиална. Унтраавал «Цаг захиалах» нь утас, мессежийн цонх хэвээр.">
        <div className="space-y-4">
          <Checkbox label="Онлайн захиалга асаах" checked={v.enabled} onChange={(e) => set("enabled", e.target.checked)} />
          <fieldset className="grid gap-3 md:grid-cols-2">
            <legend className="mb-2 text-[14px] font-medium">Баталгаажуулалт</legend>
            {(
              [
                ["APPROVAL", "Ресепшн батална (анхдагч)", "Захиалга «батлахыг хүлээж буй» төлөвтэй, цаг түр баригдана. Батлах / татгалзахад SMS очно."],
                ["INSTANT", "Шууд баталгаажна", "Сул цаг сонгомогц баталгаажна."],
              ] as const
            ).map(([m, label, hint]) => (
              <label key={m} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${v.mode === m ? "border-navy bg-navy/[0.03]" : "border-hairline"}`}>
                <input type="radio" name="mode" className="mt-1 accent-navy" checked={v.mode === m} onChange={() => set("mode", m)} />
                <span>
                  <span className="block text-[15px] font-medium">{label}</span>
                  <span className="mt-1 block text-[14px] text-ink-soft">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Хамгийн эрт (цагийн өмнө)" htmlFor="ob-min" error={fieldErrors.minLeadHours}>
              <Input id="ob-min" type="number" min={0} max={168} value={v.minLeadHours} onChange={(e) => set("minLeadHours", Number(e.target.value))} />
            </Field>
            <Field label="Хамгийн хожуу (хоногийн дараа)" htmlFor="ob-max" error={fieldErrors.maxDaysAhead}>
              <Input id="ob-max" type="number" min={1} max={365} value={v.maxDaysAhead} onChange={(e) => set("maxDaysAhead", Number(e.target.value))} />
            </Field>
            <Field label="Цуцлах эрх (эхлэхээс цагийн өмнө)" htmlFor="ob-cancel" error={fieldErrors.cancelHours}>
              <Input id="ob-cancel" type="number" min={0} max={168} value={v.cancelHours} onChange={(e) => set("cancelHours", Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Анхны үйлчлүүлэгчид заавал сонгуулах оношлогоо (Skin Instant©)" htmlFor="ob-first" hint="Өмнө нь ирж байгаагүй үйлчлүүлэгч эхлээд энэ үйлчилгээг захиална.">
            <Select id="ob-first" value={v.firstVisitServiceId ?? ""} onChange={(e) => set("firstVisitServiceId", e.target.value || null)} className="max-w-[420px]">
              <option value="">Шаардахгүй</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
      </Card>
      <Card title="Онлайнаар захиалж болох үйлчилгээ" description="Захиалах боломжтой, сайтад нийтэлсэн үйлчилгээнээс.">
        <Checkbox label="Бүх үйлчилгээ" checked={v.allServices} onChange={(e) => set("allServices", e.target.checked)} />
        {!v.allServices && (
          <div className="mt-3 grid gap-1 sm:grid-cols-2">
            {services.map((s) => (
              <Checkbox key={s.id} label={`${s.name}${s.category ? ` · ${s.category}` : ""}`} checked={v.serviceIds.includes(s.id)} onChange={() => toggle(s.id)} />
            ))}
          </div>
        )}
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Хадгалж байна…" : "Хадгалах"}</Button>
      </div>
    </form>
  );
}
