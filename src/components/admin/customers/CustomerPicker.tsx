"use client";

import { Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Card, Checkbox, Field, Input } from "@/components/admin/ui";
import { t } from "@/i18n";
import { createCustomerAction, posSearchCustomers } from "@/server/actions/pos";

const s = t.admin.pos;

export type PickedCustomer = { id: string; name: string; phone: string; email: string | null };

/** Customer search + inline create — shared by POS and the appointment dialog */
export function CustomerPicker({ customer, onChange, extra }: { customer: PickedCustomer | null; onChange: (c: PickedCustomer | null) => void; extra?: ReactNode }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedCustomer[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", marketingConsent: false });
  const create = useServerAction(createCustomerAction);

  useEffect(() => {
    if (q.trim().length < 2) return;
    let stale = false;
    const id = setTimeout(async () => {
      const res = await posSearchCustomers(q);
      if (res.ok && !stale) setResults(res.data);
    }, 250);
    return () => {
      stale = true;
      clearTimeout(id);
    };
  }, [q]);

  return (
    <Card title={s.customer} actions={customer && <Button size="sm" variant="ghost" onClick={() => onChange(null)}>{s.change}</Button>}>
      {customer ? (
        <div className="flex items-center gap-3">
          <UserRound className="size-8 rounded-full bg-navy/5 p-1.5 text-navy/60" aria-hidden />
          <div className="min-w-0 text-[14px]">
            <Link href={`/admin/customers/${customer.id}`} target="_blank" className="block truncate font-medium hover:underline">
              {customer.name}
            </Link>
            <p className="text-[12px] text-navy/55">
              {customer.phone}
              {customer.email ? ` · ${customer.email}` : ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.customerSearch} aria-label={s.customerSearch} />
          {q.trim().length >= 2 && results.length > 0 && (
            <ul className="divide-y divide-line rounded-md border border-line">
              {results.map((c) => (
                <li key={c.id}>
                  <button type="button" className="w-full px-3 py-2 text-left text-[13.5px] hover:bg-navy/[0.03]" onClick={() => (onChange(c), setQ(""), setResults([]))}>
                    {c.name} <span className="text-navy/50">· {c.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {extra}
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-navy/50">{s.walkIn}</span>
            <Button size="sm" variant="secondary" onClick={() => (setCreating(true), setForm((f) => ({ ...f, phone: /^\d/.test(q) ? q : f.phone, name: /^\d/.test(q) ? f.name : q })))}>
              <Plus className="size-3.5" /> {s.newCustomer}
            </Button>
          </div>
        </div>
      )}
      <Dialog open={creating} onClose={() => setCreating(false)} title={s.newCustomer}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void create.run({ ...form, email: form.email || null }, {
              onSuccess: (c) => {
                onChange(c);
                setCreating(false);
                setForm({ name: "", phone: "", email: "", marketingConsent: false });
                setQ("");
              },
            });
          }}
        >
          <Field label={s.name} htmlFor="nc-name" error={create.fieldErrors.name}>
            <Input id="nc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label={s.phone} htmlFor="nc-phone" error={create.fieldErrors.phone}>
            <Input id="nc-phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label={s.email} htmlFor="nc-email" hint={s.emailHint} error={create.fieldErrors.email}>
            <Input id="nc-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Checkbox label={s.marketing} checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })} />
          <Button type="submit" className="w-full" disabled={create.pending}>
            {s.save}
          </Button>
        </form>
      </Dialog>
    </Card>
  );
}
