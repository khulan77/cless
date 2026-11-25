"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Input } from "@/components/admin/ui";
import { t } from "@/i18n";
import { openMonthAction } from "@/server/actions/payroll";

const P = t.admin.payroll.periods;

export function OpenMonthForm({ defaultMonth }: { defaultMonth: string }) {
  const [month, setMonth] = useState(defaultMonth);
  const router = useRouter();
  const { run, pending } = useServerAction(openMonthAction);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(month, { onSuccess: (ids) => ids[0] && router.push(`/admin/payroll/${ids[0]}`) });
      }}
    >
      <Field label={P.month} htmlFor="pm" className="w-48">
        <Input id="pm" type="month" required value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>
      <Button type="submit" disabled={pending}>{P.open}</Button>
    </form>
  );
}
