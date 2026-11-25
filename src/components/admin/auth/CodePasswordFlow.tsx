"use client";

import Link from "next/link";
import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Input } from "@/components/admin/ui";
import { activateAccountAction, requestActivationCodeAction, requestResetCodeAction, resetPasswordWithCodeAction } from "@/server/actions/staff-auth";

/** Урилга идэвхжүүлэх / нууц үг сэргээх: утас эсвэл имэйл → код → шинэ нууц үг */
export function CodePasswordFlow({ mode }: { mode: "activate" | "reset" }) {
  const [step, setStep] = useState<"id" | "code" | "done">("id");
  const [identifier, setIdentifier] = useState("");
  const [verifyId, setVerifyId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const request = useServerAction(mode === "activate" ? requestActivationCodeAction : requestResetCodeAction);
  const finish = useServerAction(mode === "activate" ? activateAccountAction : resetPasswordWithCodeAction);

  if (step === "done") {
    return (
      <div className="space-y-5">
        <p role="status" className="rounded-xl bg-ok-bg px-4 py-3 text-[15px] text-ok">
          {mode === "activate" ? "Бүртгэл идэвхжлээ." : "Нууц үг солигдлоо."} Шинэ нууц үгээрээ нэвтэрнэ үү.
        </p>
        <Link href="/admin/login" className="flex h-12 w-full items-center justify-center rounded-xl bg-navy text-[16px] font-medium text-white">Нэвтрэх</Link>
      </div>
    );
  }

  if (step === "id") {
    return (
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          request.run(identifier, { onSuccess: (r) => { setVerifyId(r.id); setStep("code"); } });
        }}
      >
        <Field label="Утас эсвэл имэйл" htmlFor="identifier" error={request.fieldErrors.identifier}>
          <Input id="identifier" required autoComplete="username" inputMode="email" placeholder="99112233" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="h-12 text-[16px]" />
        </Field>
        <Button type="submit" disabled={request.pending} className="h-12 w-full text-[16px]">{request.pending ? "Илгээж байна…" : "Код авах"}</Button>
      </form>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        finish.run({ id: verifyId, identifier, code, password, confirm }, { onSuccess: () => setStep("done") });
      }}
    >
      <p className="text-[14px] text-ink-soft">Хэрэв бүртгэлтэй бол {identifier} руу 6 оронтой код илгээгдлээ. Код 5 минут хүчинтэй.</p>
      <Field label="Код" htmlFor="code" error={finish.fieldErrors.code}>
        <Input id="code" required autoComplete="one-time-code" inputMode="numeric" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="h-12 text-[20px] tracking-[0.3em]" />
      </Field>
      <Field label="Шинэ нууц үг" htmlFor="password" hint="8+ тэмдэгт, хэт энгийн биш" error={finish.fieldErrors.password}>
        <Input id="password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 text-[16px]" />
      </Field>
      <Field label="Нууц үг давтах" htmlFor="confirm" error={finish.fieldErrors.confirm}>
        <Input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12 text-[16px]" />
      </Field>
      <Button type="submit" disabled={finish.pending} className="h-12 w-full text-[16px]">{finish.pending ? "Шалгаж байна…" : mode === "activate" ? "Бүртгэл идэвхжүүлэх" : "Нууц үг солих"}</Button>
      <button type="button" className="w-full text-[14px] text-ink-soft underline underline-offset-4" disabled={request.pending} onClick={() => request.run(identifier, { onSuccess: (r) => setVerifyId(r.id) })}>
        Код дахин авах
      </button>
    </form>
  );
}
