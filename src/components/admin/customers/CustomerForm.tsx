"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { createCustomerAction, updateCustomerAction } from "@/server/actions/pos";

const s = t.admin.customers;
type SkinType = keyof typeof t.admin.skinTypes;
export type CustomerFormValue = {
  name: string;
  phone: string;
  email: string;
  birthday: string;
  skinType: SkinType | "";
  notes: string;
  marketingConsent: boolean;
};
const empty: CustomerFormValue = { name: "", phone: "", email: "", birthday: "", skinType: "", notes: "", marketingConsent: false };

export function CustomerFormButton({ id, initial, label }: { id?: string; initial?: CustomerFormValue; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<CustomerFormValue>(initial ?? empty);
  const create = useServerAction(createCustomerAction);
  const update = useServerAction((input: Parameters<typeof createCustomerAction>[0]) => updateCustomerAction(id!, input));
  const a = id ? update : create;
  const fe = a.fieldErrors;

  return (
    <>
      <Button variant={id ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={label}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const input = { ...v, email: v.email || null, birthday: v.birthday || null, skinType: v.skinType || null, notes: v.notes || null };
            void a.run(input, {
              onSuccess: (data) => {
                setOpen(false);
                if (!id && data && typeof data === "object" && "id" in data) router.push(`/admin/customers/${data.id}`);
                else router.refresh();
              },
            });
          }}
        >
          <Field label={s.name} htmlFor="cf-name" error={fe.name}>
            <Input id="cf-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={s.phone} htmlFor="cf-phone" error={fe.phone}>
              <Input id="cf-phone" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
            </Field>
            <Field label={s.birthday} htmlFor="cf-bday" error={fe.birthday}>
              <Input id="cf-bday" type="date" value={v.birthday} onChange={(e) => setV({ ...v, birthday: e.target.value })} />
            </Field>
          </div>
          <Field label={s.email} htmlFor="cf-email" error={fe.email}>
            <Input id="cf-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </Field>
          <Field label={s.skinType} htmlFor="cf-skin">
            <Select id="cf-skin" value={v.skinType} onChange={(e) => setV({ ...v, skinType: e.target.value as SkinType | "" })}>
              <option value="">—</option>
              {Object.entries(t.admin.skinTypes).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={s.notes} htmlFor="cf-notes">
            <Textarea id="cf-notes" className="min-h-16" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </Field>
          <Checkbox label={s.marketing} checked={v.marketingConsent} onChange={(e) => setV({ ...v, marketingConsent: e.target.checked })} />
          <Button type="submit" className="w-full" disabled={a.pending}>
            {s.save}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
