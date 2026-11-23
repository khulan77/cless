"use client";

import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Input } from "@/components/admin/ui";
import { t } from "@/i18n";
import { changePasswordAction } from "@/server/actions/account";

const a = t.admin.account;

export function ChangePasswordForm() {
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const act = useServerAction(changePasswordAction);
  const fe = act.fieldErrors;
  return (
    <form
      className="max-w-sm space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void act.run(v);
      }}
    >
      <Field label={a.current} htmlFor="pw-current" error={fe.current}>
        <Input id="pw-current" type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} />
      </Field>
      <Field label={a.next} htmlFor="pw-next" hint={a.nextHint} error={fe.next}>
        <Input id="pw-next" type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} />
      </Field>
      <Field label={a.confirm} htmlFor="pw-confirm" error={fe.confirm}>
        <Input id="pw-confirm" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
      </Field>
      <p className="text-[13px] text-ink-soft">{a.afterChange}</p>
      <Button type="submit" disabled={act.pending || !v.current || !v.next || !v.confirm}>
        {a.submit}
      </Button>
    </form>
  );
}
