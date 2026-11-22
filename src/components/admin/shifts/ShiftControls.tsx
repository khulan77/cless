"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { cashMoveAction, closeShiftAction, openShiftAction } from "@/server/actions/pos";

const s = t.admin.shifts;

export function OpenShiftForm() {
  const router = useRouter();
  const [cash, setCash] = useState<number>(Number.NaN);
  const a = useServerAction(openShiftAction);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run(cash, { onSuccess: () => router.refresh() });
      }}
    >
      <Field label={s.openingCash} htmlFor="sh-open" error={a.fieldErrors.openingCash}>
        <MoneyInput id="sh-open" className="w-full" value={cash} onChange={setCash} autoFocus />
      </Field>
      <Button type="submit" disabled={a.pending || Number.isNaN(cash)}>
        {s.open}
      </Button>
    </form>
  );
}

export function ShiftOpenControls({ shiftId, expected }: { shiftId: string; expected: number }) {
  const router = useRouter();
  const [move, setMove] = useState<{ type: "PAY_IN" | "PAY_OUT"; amount: number; note: string }>({ type: "PAY_OUT", amount: Number.NaN, note: "" });
  const [counted, setCounted] = useState<number>(Number.NaN);
  const [note, setNote] = useState("");
  const m = useServerAction(cashMoveAction);
  const c = useServerAction(closeShiftAction);
  const diff = Number.isNaN(counted) ? null : counted - expected;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={`${s.payIn} / ${s.payOut}`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void m.run({ shiftId, ...move }, { onSuccess: () => (setMove({ ...move, amount: Number.NaN, note: "" }), router.refresh()) });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label=" " htmlFor="mv-type">
              <Select id="mv-type" value={move.type} onChange={(e) => setMove({ ...move, type: e.target.value as "PAY_IN" })}>
                <option value="PAY_OUT">{s.payOut}</option>
                <option value="PAY_IN">{s.payIn}</option>
              </Select>
            </Field>
            <Field label={s.moveAmount} htmlFor="mv-amount" error={m.fieldErrors.amount}>
              <MoneyInput id="mv-amount" className="w-full" value={move.amount} onChange={(v) => setMove({ ...move, amount: v })} />
            </Field>
          </div>
          <Field label={s.moveNote} htmlFor="mv-note" error={m.fieldErrors.note}>
            <Input id="mv-note" value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} />
          </Field>
          <Button type="submit" variant="secondary" disabled={m.pending}>
            {s.submitMove}
          </Button>
        </form>
      </Card>

      <Card title={s.close}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!window.confirm(s.confirmClose)) return;
            void c.run({ shiftId, countedCash: counted, note: note || null }, { onSuccess: () => router.push(`/admin/shifts/${shiftId}`) });
          }}
        >
          <p className="text-[14px]">
            {s.expected}: <span className="tabular-nums font-medium">{formatMNT(expected)}</span>
          </p>
          <Field label={s.counted} htmlFor="sh-counted" error={c.fieldErrors.countedCash}>
            <MoneyInput id="sh-counted" className="w-full" value={counted} onChange={setCounted} />
          </Field>
          {diff !== null && (
            <p className={`text-[14px] ${diff === 0 ? "text-emerald-700" : "text-red-700"}`}>
              {s.difference}: <span className="tabular-nums">{diff > 0 ? "+" : ""}{formatMNT(diff)}</span>
            </p>
          )}
          {diff !== null && diff !== 0 && (
            <Field label={s.closeNote} htmlFor="sh-note" error={c.fieldErrors.note}>
              <Textarea id="sh-note" className="min-h-16" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          )}
          <Button type="submit" variant="danger" disabled={c.pending || Number.isNaN(counted)}>
            {s.close}
          </Button>
        </form>
      </Card>
    </div>
  );
}
