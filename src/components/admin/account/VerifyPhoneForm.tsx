"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Input } from "@/components/admin/ui";
import { confirmPhoneAction, requestPhoneCodeAction } from "@/server/actions/users";

/** Утсаа баталгаажуулж утсаар нэвтрэх боломжтой болно (хуучин хэрэглэгчид) */
export function VerifyPhoneForm({ current }: { current: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState(current ?? "");
  const [id, setId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const request = useServerAction(requestPhoneCodeAction);
  const confirm = useServerAction(confirmPhoneAction);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!id) request.run(phone, { onSuccess: (r) => setId(r.id) });
        else confirm.run({ id, phone, code }, { onSuccess: () => { setId(null); setCode(""); router.refresh(); } });
      }}
    >
      <Field label="Утас" htmlFor="vp-phone" error={request.fieldErrors.phone} className="w-48">
        <Input id="vp-phone" type="tel" inputMode="tel" required value={phone} disabled={Boolean(id)} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      {id && (
        <Field label="Код" htmlFor="vp-code" className="w-36">
          <Input id="vp-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </Field>
      )}
      <Button type="submit" disabled={request.pending || confirm.pending}>{id ? "Баталгаажуулах" : "Код авах"}</Button>
    </form>
  );
}
