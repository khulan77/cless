"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/server/actions/auth";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-5" noValidate={false}>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-micro block">
          Имэйл
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={state.email}
          className="h-11 w-full border-b border-navy/30 bg-transparent text-[15px] focus:border-navy focus:outline-none"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-micro block">
          Нууц үг
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-11 w-full border-b border-navy/30 bg-transparent text-[15px] focus:border-navy focus:outline-none"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-full bg-navy text-[14px] tracking-[0.3px] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Шалгаж байна…" : "Нэвтрэх"}
      </button>
    </form>
  );
}
