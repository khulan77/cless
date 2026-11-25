"use client";

import { Field, Select, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { CANCEL_CATEGORIES, CANCEL_CATEGORY_LABELS, type CancelCategory } from "@/server/modules/appointments/cancel";

const c = t.admin.calendar;

export type CancelValue = { category: CancelCategory | ""; note: string };
export const emptyCancel: CancelValue = { category: "", note: "" };
/** Category chosen; "Бусад" also needs a note */
export const cancelReady = (v: CancelValue) => v.category !== "" && (v.category !== "OTHER" || v.note.trim().length > 0);

/** Why the appointment is cancelled: a fixed category (for the cancellations report) + a note */
export function CancelReasonFields({ id, value, onChange }: { id: string; value: CancelValue; onChange: (v: CancelValue) => void }) {
  return (
    <div className="space-y-3">
      <Field label={c.reason} htmlFor={`${id}-category`}>
        <Select id={`${id}-category`} value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value as CancelCategory })} autoFocus>
          <option value="">{c.chooseReason}</option>
          {CANCEL_CATEGORIES.map((k) => (
            <option key={k} value={k}>
              {CANCEL_CATEGORY_LABELS[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={value.category === "OTHER" ? c.cancelNoteRequired : c.cancelNote} htmlFor={`${id}-note`}>
        <Textarea id={`${id}-note`} className="min-h-16" maxLength={300} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      </Field>
    </div>
  );
}
