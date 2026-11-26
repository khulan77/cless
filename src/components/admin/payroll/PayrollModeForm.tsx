"use client";

import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Checkbox, Field, Input, Select } from "@/components/admin/ui";
import { t } from "@/i18n";
import { savePayrollSettingsAction } from "@/server/actions/payroll";

const R = t.admin.payroll.rates;
type Mode = "ADVANCE_FINAL" | "INDEPENDENT";

export function PayrollModeForm({
  initial,
}: {
  initial: { mode: Mode; splitDay: number; advanceWithholding: boolean; commissionBase: "NET" | "GROSS"; autoAttendanceSince: string | null; attendanceAdminEdit: boolean };
}) {
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [splitDay, setSplitDay] = useState(String(initial.splitDay));
  const [withhold, setWithhold] = useState(initial.advanceWithholding);
  const [commissionBase, setCommissionBase] = useState(initial.commissionBase);
  const [autoSince, setAutoSince] = useState(initial.autoAttendanceSince ?? "");
  const [adminEdit, setAdminEdit] = useState(initial.attendanceAdminEdit);
  const { run, pending, fieldErrors } = useServerAction(savePayrollSettingsAction);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run({ mode, splitDay: Number(splitDay), advanceWithholding: withhold, commissionBase, autoAttendanceSince: autoSince || null, attendanceAdminEdit: adminEdit });
      }}
    >
      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="mb-2 text-[14px] font-medium">{R.mode}</legend>
        {(
          [
            ["ADVANCE_FINAL", R.modeAdvance, R.modeAdvanceHint],
            ["INDEPENDENT", R.modeIndependent, R.modeIndependentHint],
          ] as const
        ).map(([v, label, hint]) => (
          <label key={v} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${mode === v ? "border-navy bg-navy/[0.03]" : "border-hairline"}`}>
            <input type="radio" name="mode" className="mt-1 accent-navy" checked={mode === v} onChange={() => setMode(v)} />
            <span>
              <span className="block text-[15px] font-medium">{label}</span>
              <span className="mt-1 block text-[14px] text-ink-soft">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-end gap-4">
        <Field label={R.splitDay} htmlFor="split" error={fieldErrors.splitDay} className="w-56">
          <Input id="split" type="number" min={5} max={25} value={splitDay} onChange={(e) => setSplitDay(e.target.value)} />
        </Field>
        {mode === "ADVANCE_FINAL" && <Checkbox label={R.advanceWithholding} checked={withhold} onChange={(e) => setWithhold(e.target.checked)} />}
      </div>
      <Field label="Урамшууллыг ямар дүнгээс бодох" htmlFor="commission-base" hint="Анхдагч: НӨАТ-тэй нийт дүнгээс (өмнөх тооцоотой ижил). Нягтлан баталгаажуулна." className="max-w-md">
        <Select id="commission-base" value={commissionBase} onChange={(e) => setCommissionBase(e.target.value as "NET" | "GROSS")}>
          <option value="GROSS">НӨАТ-тэй нийт дүнгээс</option>
          <option value="NET">НӨАТ-гүй цэвэр дүнгээс (400 000₮ → 363 636₮)</option>
        </Select>
      </Field>
      <fieldset className="space-y-3 rounded-2xl border border-hairline p-4">
        <legend className="px-1 text-[14px] font-medium">Ирц (автомат)</legend>
        <Field
          label="Автомат ирц эхлэх өдөр"
          htmlFor="auto-since"
          error={fieldErrors.autoAttendanceSince}
          hint="Энэ өдрөөс хойш «Ирлээ» дараагүй хуваарийн өдөр цалинд «тасалсан» болно. Хоосон = хуучин дүрэм (хуваарийн өдөр ажилласанд тооцно). Ажилтнууд «Ирлээ/Явлаа»-г хэрэглэж эхэлсэн өдрийг оруулна."
          className="max-w-md"
        >
          <Input id="auto-since" type="date" value={autoSince} onChange={(e) => setAutoSince(e.target.value)} />
        </Field>
        <Checkbox label="Админ ирцийг гараар засах (заавал шалтгаантай)" checked={adminEdit} onChange={(e) => setAdminEdit(e.target.checked)} />
      </fieldset>
      <Button type="submit" disabled={pending}>{pending ? t.admin.saving : R.save}</Button>
    </form>
  );
}
