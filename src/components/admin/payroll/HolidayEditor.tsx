"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, IconButton, Input } from "@/components/admin/ui";
import { t } from "@/i18n";
import { addHolidayAction, removeHolidayAction } from "@/server/actions/payroll";

const H = t.admin.payroll.hol;

export function HolidayEditor({ holidays }: { holidays: { id: string; date: string; name: string }[] }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const add = useServerAction(addHolidayAction);
  const remove = useServerAction(removeHolidayAction);

  return (
    <div className="space-y-5">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          add.run({ date, name }, { onSuccess: () => { setDate(""); setName(""); } });
        }}
      >
        <Field label={H.date} htmlFor="hol-date" error={add.fieldErrors.date} className="w-44">
          <Input id="hol-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={H.name} htmlFor="hol-name" error={add.fieldErrors.name} className="min-w-56 flex-1">
          <Input id="hol-name" required maxLength={80} placeholder={H.namePh} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" disabled={add.pending}>{H.add}</Button>
      </form>

      {holidays.length === 0 ? (
        <p className="text-[15px] text-ink-soft">{H.empty}</p>
      ) : (
        <ul className="divide-y divide-hairline rounded-2xl border border-hairline bg-white">
          {holidays.map((h) => (
            <li key={h.id} className="flex min-h-14 items-center gap-4 px-5">
              <span className="w-28 font-mono text-[14px] tabular-nums">{h.date}</span>
              <span className="flex-1 text-[15px]">{h.name}</span>
              <IconButton label={`${t.admin.remove}: ${h.name}`} disabled={remove.pending} onClick={() => remove.run(h.id)}>
                <Trash2 className="size-[18px]" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
