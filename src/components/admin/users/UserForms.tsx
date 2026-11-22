"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/admin/MoneyInput";
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
        if (!p.success) { setFieldErrors(collect(p.error.issues)); toast.error("Маягтын алдааг засна уу."); return; }
        await run(form, { onSuccess: ({ id }) => router.push(`/admin/users/${id}`) });
      }}
    >
      <Card title="Шинэ хэрэглэгч">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Нэр" htmlFor="name" error={fieldErrors.name}><Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Имэйл" htmlFor="email" error={fieldErrors.email}><Input id="email" type="email" autoComplete="off" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Утас" htmlFor="phone" error={fieldErrors.phone}><Input id="phone" type="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Эрх" htmlFor="role">
            <Select id="role" value={form.role} onChange={(e) => set("role", e.target.value as CreateUserInput["role"])}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
          <Field label="Үндсэн цалин" htmlFor="baseSalary" error={fieldErrors.baseSalary}>
            <MoneyInput id="baseSalary" value={form.baseSalary} onChange={(v) => set("baseSalary", v)} invalid={Boolean(fieldErrors.baseSalary)} className="w-full" />
          </Field>
          <Field label="Түр нууц үг" htmlFor="password" error={fieldErrors.password} hint="8+ тэмдэгт. Хэрэглэгчид өөрөө дамжуулна.">
            <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => router.push("/admin/users")}>Болих</Button>
          <Button type="submit" disabled={pending}>{pending ? "Хадгалж байна…" : "Хэрэглэгч нэмэх"}</Button>
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
        if (!p.success) { setFieldErrors(collect(p.error.issues)); toast.error("Маягтын алдааг засна уу."); return; }
        await run(form, { onSuccess: () => router.refresh() });
      }}
    >
      <Card title="Мэдээлэл" description={email}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Нэр" htmlFor="name" error={fieldErrors.name}><Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Утас" htmlFor="phone" error={fieldErrors.phone}><Input id="phone" type="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Эрх" htmlFor="role" error={fieldErrors.role} hint={isSelf ? "Өөрийнхөө эрхийг өөрчлөх боломжгүй" : undefined}>
            <Select id="role" value={form.role} disabled={isSelf} onChange={(e) => set("role", e.target.value as UpdateUserInput["role"])}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
          <Field label="Үндсэн цалин" htmlFor="baseSalary" error={fieldErrors.baseSalary}>
            <MoneyInput id="baseSalary" value={form.baseSalary} onChange={(v) => set("baseSalary", v)} invalid={Boolean(fieldErrors.baseSalary)} className="w-full" />
          </Field>
          <div className="md:col-span-2">
            <Checkbox label="Идэвхтэй (нэвтэрч чадна)" checked={form.isActive} disabled={isSelf} onChange={(e) => set("isActive", e.target.checked)} />
            {fieldErrors.isActive && <p className="mt-1 text-[12px] text-red-600">{fieldErrors.isActive[0]}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end border-t border-line pt-4">
          <Button type="submit" disabled={pending}>{pending ? "Хадгалж байна…" : "Хадгалах"}</Button>
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
      <Card title="Нууц үг шинэчлэх" description="Хэрэглэгчийн түгжээг мөн нээнэ.">
        <Field label="Шинэ нууц үг" htmlFor="new-password" error={fieldErrors.password}>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="mt-4 flex justify-end">
          <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Шинэчилж байна…" : "Нууц үг шинэчлэх"}</Button>
        </div>
      </Card>
    </form>
  );
}
