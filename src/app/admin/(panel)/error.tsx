"use client";

import Link from "next/link";
import { Button, btnClass } from "@/components/admin/ui";
import { t } from "@/i18n";

/** Admin error boundary — shows the error ID that is also in the server log */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-16 max-w-lg rounded-2xl border border-err/30 bg-white p-6">
      <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-danger">{t.serverError.code}</p>
      <h1 className="mt-1 text-[18px] font-medium">{t.serverError.title}</h1>
      <p className="mt-2 text-[14px] text-ink-soft">{t.serverError.adminText}</p>
      {error.digest && (
        <p className="mt-3 rounded bg-ink/[0.04] px-3 py-2 font-mono text-[13px]" data-testid="error-id">
          {t.serverError.errorId(error.digest)}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Button onClick={reset}>{t.serverError.retry}</Button>
        <Link href="/admin" className={btnClass("secondary")}>
          {t.serverError.adminHome}
        </Link>
      </div>
    </div>
  );
}
