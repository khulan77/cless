"use client";

import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Checkbox, Field, Input } from "@/components/admin/ui";
import { t } from "@/i18n";
import { savePayrollSettingsAction } from "@/server/actions/payroll";

const R = t.admin.payroll.rates;
type Mode = "ADVANCE_FINAL" | "INDEPENDENT";

export function PayrollModeForm({ initial }: { initial: { mode: Mode; splitDay: number; advanceWithholding: boolean } }) {
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [splitDay, setSplitDay] = useState(String(initial.splitDay));
  const [withhold, setWithhold] = useState(initial.advanceWithholding);
  const { run, pending, fieldErrors } = useServerAction(savePayrollSettingsAction);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run({ mode, splitDay: Number(splitDay), advanceWithholding: withhold });
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
      <Button type="submit" disabled={pending}>{pending ? t.admin.saving : R.save}</Button>
    </form>
  );
}
