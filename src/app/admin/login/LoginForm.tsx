"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/server/actions/auth";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-5" noValidate={false}>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-[14px] font-medium text-ink">
          Имэйл
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={state.email}
          className="h-12 w-full rounded-xl border border-hairline bg-white px-4 text-[16px] text-ink transition-colors hover:border-ink/20 focus:border-navy focus:outline-none focus:ring-2 focus:ring-champagne/30"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-[14px] font-medium text-ink">
          Нууц үг
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-12 w-full rounded-xl border border-hairline bg-white px-4 text-[16px] text-ink transition-colors hover:border-ink/20 focus:border-navy focus:outline-none focus:ring-2 focus:ring-champagne/30"
        />
      </div>
      {state.error && (
        <p role="alert" className="rounded-xl bg-err-bg px-4 py-3 text-[14px] text-err">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-navy text-[16px] font-medium text-white transition-colors hover:bg-[#1a3260] disabled:opacity-60"
      >
        {pending ? "Шалгаж байна…" : "Нэвтрэх"}
      </button>
    </form>
  );
}
