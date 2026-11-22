"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { t } from "@/i18n";
import { Button, Card, Checkbox, Field, Input, Select } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { ROLE_LABELS } from "@/server/auth/permissions";
import {
  ROLES, createUserSchema, passwordSchema, updateUserSchema, type CreateUserInput, type UpdateUserInput,
} from "@/lib/validation/user";
import { createUser, resetPassword, updateUser } from "@/server/actions/users";


function collect(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string[]> = {};
  for (const i of issues) (errors[i.path.join(".") || "_"] ??= []).push(i.message);
  return errors;
}

export function CreateUserForm() {
  const router = useRouter();
  const [form, setForm] = useState<CreateUserInput>({ name: "", email: "", phone: "", role: "STAFF", baseSalary: 0, password: "" });
  const { run, pending, fieldErrors, setFieldErrors } = useServerAction(createUser);
  const set = <K extends keyof CreateUserInput>(k: K, v: CreateUserInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      noValidate
      className="max-w-[640px]"
      onSubmit={async (e) => {
        e.preventDefault();
        const p = createUserSchema.safeParse(form);
        if (!p.success) { setFieldErrors(collect(p.error.issues)); toast.error(t.admin.fixFormErrors); return; }
        await run(form, { onSuccess: ({ id }) => router.push(`/admin/users/${id}`) });
      }}
    >
      <Card title={t.admin.users.newUser}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t.admin.name} htmlFor="name" error={fieldErrors.name}><Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label={t.admin.users.email} htmlFor="email" error={fieldErrors.email}><Input id="email" type="email" autoComplete="off" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label={t.admin.users.phone} htmlFor="phone" error={fieldErrors.phone}><Input id="phone" type="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label={t.admin.users.role} htmlFor="role">
            <Select id="role" value={form.role} onChange={(e) => set("role", e.target.value as CreateUserInput["role"])}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
          <Field label={t.admin.users.baseSalary} htmlFor="baseSalary" error={fieldErrors.baseSalary}>
            <MoneyInput id="baseSalary" value={form.baseSalary} onChange={(v) => set("baseSalary", v)} invalid={Boolean(fieldErrors.baseSalary)} className="w-full" />
          </Field>
          <Field label={t.admin.users.tempPassword} htmlFor="password" error={fieldErrors.password} hint={t.admin.users.tempPasswordHint}>
            <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => router.push("/admin/users")}>{t.admin.cancel}</Button>
          <Button type="submit" disabled={pending}>{pending ? t.admin.saving : t.admin.users.addUser}</Button>
        </div>
      </Card>
    </form>
  );
}

export function EditUserForm({ initial, email, isSelf }: { initial: UpdateUserInput; email: string; isSelf: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<UpdateUserInput>(initial);
  const { run, pending, fieldErrors, setFieldErrors } = useServerAction(updateUser);
  const set = <K extends keyof UpdateUserInput>(k: K, v: UpdateUserInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const p = updateUserSchema.safeParse(form);
        if (!p.success) { setFieldErrors(collect(p.error.issues)); toast.error(t.admin.fixFormErrors); return; }
        await run(form, { onSuccess: () => router.refresh() });
      }}
    >
      <Card title={t.admin.users.info} description={email}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t.admin.name} htmlFor="name" error={fieldErrors.name}><Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label={t.admin.users.phone} htmlFor="phone" error={fieldErrors.phone}><Input id="phone" type="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label={t.admin.users.role} htmlFor="role" error={fieldErrors.role} hint={isSelf ? t.admin.users.selfRoleHint : undefined}>
            <Select id="role" value={form.role} disabled={isSelf} onChange={(e) => set("role", e.target.value as UpdateUserInput["role"])}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
          <Field label={t.admin.users.baseSalary} htmlFor="baseSalary" error={fieldErrors.baseSalary}>
            <MoneyInput id="baseSalary" value={form.baseSalary} onChange={(v) => set("baseSalary", v)} invalid={Boolean(fieldErrors.baseSalary)} className="w-full" />
          </Field>
          <div className="md:col-span-2">
            <Checkbox label={t.admin.users.activeLogin} checked={form.isActive} disabled={isSelf} onChange={(e) => set("isActive", e.target.checked)} />
            {fieldErrors.isActive && <p className="mt-1 text-[12px] text-red-600">{fieldErrors.isActive[0]}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end border-t border-line pt-4">
          <Button type="submit" disabled={pending}>{pending ? t.admin.saving : t.admin.save}</Button>
        </div>
      </Card>
    </form>
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
      <Card title={t.admin.users.resetTitle} description={t.admin.users.resetHint}>
        <Field label={t.admin.users.newPassword} htmlFor="new-password" error={fieldErrors.password}>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="mt-4 flex justify-end">
          <Button type="submit" variant="secondary" disabled={pending}>{pending ? t.admin.users.resetting : t.admin.users.resetTitle}</Button>
        </div>
      </Card>
    </form>
  );
}
