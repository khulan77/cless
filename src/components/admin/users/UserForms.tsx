"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { t } from "@/i18n";
import { Button, Card, Checkbox, Field, Input, Select } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { passwordSchema } from "@/lib/validation/user";
import { cancelInviteAction, inviteUserAction, resendInviteAction, resetPassword, updateUserAction } from "@/server/actions/users";

type Role = "ADMIN" | "MANAGER" | "ACCOUNTANT" | "STAFF";
const U = t.admin.users;

/** Шинэ ажилтан: нэр, утас (заавал), имэйл (сонголтоор), эрх — нууц үггүй (урилгаар) */
export function InviteUserForm({ roles, canSalary }: { roles: readonly Role[]; canSalary: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "", role: roles.includes("STAFF") ? "STAFF" : roles[0]!, baseSalary: 0 });
  const { run, pending, fieldErrors } = useServerAction(inviteUserAction);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      noValidate
      className="max-w-[640px]"
      onSubmit={async (e) => {
        e.preventDefault();
        await run(
          { name: form.name, phone: form.phone, email: form.email, role: form.role as Role, ...(canSalary ? { baseSalary: form.baseSalary } : {}) },
          {
            onSuccess: ({ id, delivery }) => {
              if (delivery.ok) toast.success(U.invited);
              else toast.error(U.inviteFailed("error" in delivery ? delivery.error : ""), { duration: 10_000 });
              router.push(`/admin/users/${id}`);
            },
          },
        );
      }}
    >
      <Card title={U.newUser} description={U.inviteHint}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t.admin.name} htmlFor="name" error={fieldErrors.name}><Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label={U.phoneRequired} htmlFor="phone" error={fieldErrors.phone}><Input id="phone" type="tel" inputMode="tel" placeholder="99112233" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label={U.emailOptional} htmlFor="email" error={fieldErrors.email}><Input id="email" type="email" autoComplete="off" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label={U.role} htmlFor="role" hint={roles.length === 1 ? U.managerHint : undefined}>
            <Select id="role" value={form.role} disabled={roles.length === 1} onChange={(e) => set("role", e.target.value as Role)}>
              {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
          {canSalary && (
            <Field label={U.baseSalary} htmlFor="baseSalary" error={fieldErrors.baseSalary}>
              <MoneyInput id="baseSalary" value={form.baseSalary} onChange={(v) => set("baseSalary", v)} invalid={Boolean(fieldErrors.baseSalary)} className="w-full" />
            </Field>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="secondary" onClick={() => router.push("/admin/users")}>{t.admin.cancel}</Button>
          <Button type="submit" disabled={pending}>{pending ? U.inviting : U.invite}</Button>
        </div>
      </Card>
    </form>
  );
}

export type EditInitial = { id: string; name: string; phone: string; email: string; role: Role; baseSalary: number; isActive: boolean };

export function EditUserForm({ initial, isSelf, roles, canSalary, readOnly }: { initial: EditInitial; isSelf: boolean; roles: readonly Role[]; canSalary: boolean; readOnly: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const { run, pending, fieldErrors } = useServerAction(updateUserAction);
  const set = <K extends keyof EditInitial>(k: K, v: EditInitial[K]) => setForm((f) => ({ ...f, [k]: v }));
  const options = roles.includes(form.role) ? roles : [form.role, ...roles];
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        await run({ ...form, ...(canSalary ? {} : { baseSalary: undefined }) }, { onSuccess: () => router.refresh() });
      }}
    >
      <Card title={U.info} description={readOnly ? U.readOnlyRole : undefined}>
        <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-2">
          <Field label={t.admin.name} htmlFor="name" error={fieldErrors.name}><Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label={U.phoneRequired} htmlFor="phone" error={fieldErrors.phone}><Input id="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label={U.emailOptional} htmlFor="email" error={fieldErrors.email}><Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label={U.role} htmlFor="role" error={fieldErrors.role} hint={isSelf ? U.selfRoleHint : undefined}>
            <Select id="role" value={form.role} disabled={isSelf || roles.length <= 1} onChange={(e) => set("role", e.target.value as Role)}>
              {options.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
          {canSalary ? (
            <Field label={U.baseSalary} htmlFor="baseSalary" error={fieldErrors.baseSalary}>
              <MoneyInput id="baseSalary" value={form.baseSalary} onChange={(v) => set("baseSalary", v)} invalid={Boolean(fieldErrors.baseSalary)} className="w-full" />
            </Field>
          ) : (
            <p className="self-end text-[13px] text-ink-soft">{U.salaryHidden}</p>
          )}
          <div className="md:col-span-2">
            <Checkbox label={U.activeLogin} checked={form.isActive} disabled={isSelf} onChange={(e) => set("isActive", e.target.checked)} />
            {fieldErrors.isActive && <p className="mt-1 text-[13px] text-danger">{fieldErrors.isActive[0]}</p>}
          </div>
        </fieldset>
        {!readOnly && (
          <div className="mt-6 flex justify-end border-t border-hairline pt-4">
            <Button type="submit" disabled={pending}>{pending ? t.admin.saving : t.admin.save}</Button>
          </div>
        )}
      </Card>
    </form>
  );
}

export function InviteControls({ id, invitedAt, expiresAt, expired }: { id: string; invitedAt: string; expiresAt: string; expired: boolean }) {
  const router = useRouter();
  const resend = useServerAction(resendInviteAction);
  const cancel = useServerAction(cancelInviteAction);
  const [confirm, setConfirm] = useState(false);
  return (
    <Card title={U.inviteCard} description={U.invitedAt(invitedAt, expiresAt)}>
      {expired && <p className="mb-3 text-[14px] text-err">{U.statusExpired}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={resend.pending} onClick={() => resend.run(id, { onSuccess: () => router.refresh() })}>{U.resend}</Button>
        <Button variant="danger" onClick={() => setConfirm(true)}>{U.cancelInvite}</Button>
      </div>
      <ConfirmDialog open={confirm} danger title={U.cancelInvite} confirmLabel={U.cancelInvite} pending={cancel.pending} onClose={() => setConfirm(false)} onConfirm={() => cancel.run(id, { onSuccess: () => { setConfirm(false); router.refresh(); } })} />
    </Card>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [password, setPassword] = useState("");
  const { run, pending, fieldErrors, setFieldErrors } = useServerAction(resetPassword);
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const p = passwordSchema.safeParse(password);
        if (!p.success) { setFieldErrors({ password: [p.error.issues[0]!.message] }); return; }
        await run({ id, password }, { onSuccess: () => setPassword("") });
      }}
    >
      <Card title={U.tempFallback} description={U.tempFallbackHint}>
        <Field label={U.newPassword} htmlFor="new-password" error={fieldErrors.password}>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="mt-4 flex justify-end">
          <Button type="submit" variant="secondary" disabled={pending}>{pending ? U.resetting : U.resetTitle}</Button>
        </div>
      </Card>
    </form>
  );
}
