"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, IconButton, Input, Select } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { addAdjustmentAction, removeAdjustmentAction } from "@/server/actions/payroll";

const J = t.admin.payroll.adj;

export function AdjustmentsPanel({
  periodId,
  staff,
  items,
  canEdit,
}: {
  periodId: string;
  staff: { id: string; name: string }[];
  items: { id: string; staff: string; type: "ADDITION" | "DEDUCTION"; amount: number; reason: string }[];
  canEdit: boolean;
}) {
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [type, setType] = useState<"ADDITION" | "DEDUCTION">("ADDITION");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const add = useServerAction(addAdjustmentAction);
  const remove = useServerAction((x: { id: string }) => removeAdjustmentAction(x.id, periodId));

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="divide-y divide-hairline text-[14px]">
          {items.map((a) => (
            <li key={a.id} className="flex min-h-12 flex-wrap items-center gap-3">
              <span className="w-40 font-medium">{a.staff}</span>
              <span className={`w-32 text-right tabular-nums ${a.type === "DEDUCTION" ? "text-err" : "text-ok"}`}>
                {a.type === "DEDUCTION" ? "−" : "+"}{formatMNT(a.amount)}
              </span>
              <span className="min-w-40 flex-1 text-ink-soft">{a.reason}</span>
              {canEdit && (
                <IconButton label={`${t.admin.remove}: ${a.reason}`} disabled={remove.pending} onClick={() => remove.run({ id: a.id })}>
                  <Trash2 className="size-4" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && staff.length > 0 && (
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_10rem] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            add.run({ periodId, staffId, type, amount: Number(amount), reason }, { onSuccess: () => { setAmount(""); setReason(""); } });
          }}
        >
          <Field label={J.staff} htmlFor="adj-staff">
            <Select id="adj-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label={J.type} htmlFor="adj-type">
            <Select id="adj-type" value={type} onChange={(e) => setType(e.target.value as "ADDITION" | "DEDUCTION")}>
              <option value="ADDITION">{J.ADDITION}</option>
              <option value="DEDUCTION">{J.DEDUCTION}</option>
            </Select>
          </Field>
          <Field label={J.amount} htmlFor="adj-amount" error={add.fieldErrors.amount}>
            <Input id="adj-amount" inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />
          </Field>
          <Field label={J.reason} htmlFor="adj-reason" error={add.fieldErrors.reason} className="md:col-span-2">
            <Input id="adj-reason" required minLength={3} maxLength={200} placeholder={J.reasonPh} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button type="submit" disabled={add.pending}>{J.save}</Button>
        </form>
      )}
    </div>
  );
}
