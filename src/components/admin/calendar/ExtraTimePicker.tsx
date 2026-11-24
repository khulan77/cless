"use client";

import { t } from "@/i18n";
import { EXTRA_MINUTES } from "@/server/modules/appointments/extra-minutes";

const c = t.admin.calendar;

/** "+ Нэмэлт цаг": Үгүй / +10 / +15 / +30 мин — room prep or cleaning after the service */
export function ExtraTimePicker({ value, onChange, disabled }: { value: number; onChange: (min: number) => void; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-[14px] font-medium text-ink">{c.extraTime}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={c.extraTime}>
        {EXTRA_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            onClick={() => onChange(m)}
            className={`h-9 min-w-16 rounded-full border px-3.5 text-[14px] tabular-nums transition-colors disabled:opacity-50 ${
              value === m ? "border-navy bg-navy text-white" : "border-hairline bg-white text-ink hover:border-ink/25"
            }`}
          >
            {m === 0 ? c.extraNone : `+${m} ${c.min}`}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[13px] text-ink-soft">{c.extraHint}</p>
    </fieldset>
  );
}
