"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { saveAccountantEmailsAction } from "@/server/actions/accountant";

const A = t.admin.accountant;

/** Нягтлангийн имэйл — нэг мөрөнд нэг хаяг */
export function AccountantEmailsForm({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [text, setText] = useState(initial.join("\n"));
  const a = useServerAction(saveAccountantEmailsAction);
  const err = Object.entries(a.fieldErrors).flatMap(([, v]) => v)[0];
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run({ emails: text.split(/[\n,;]+/) }, { onSuccess: () => router.refresh() });
      }}
    >
      <Field label={A.emails} htmlFor="acct-emails" hint={A.emailsHint} error={err}>
        <Textarea id="acct-emails" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="nyagtlan@example.mn" />
      </Field>
      <Button type="submit" disabled={a.pending}>
        {A.save}
      </Button>
    </form>
  );
}
