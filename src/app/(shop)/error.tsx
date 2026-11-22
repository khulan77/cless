"use client";

import { PillLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { t } from "@/i18n";

/** Storefront 500 — the error ID (digest) matches the server JSON log line (instrumentation.ts) */
export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container as="section" className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="text-micro text-muted">{t.serverError.code}</p>
      <h1 className="text-section mt-3">{t.serverError.title}</h1>
      <p className="mt-4 max-w-[46ch] text-muted">{t.serverError.text}</p>
      {error.digest && <p className="mt-3 font-mono text-[12px] text-muted">{t.serverError.errorId(error.digest)}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="inline-flex rounded-full border border-navy px-5 py-2.5 text-[14px] hover:bg-navy hover:text-white">
          {t.serverError.retry}
        </button>
        <PillLink href="/">{t.common.backHome}</PillLink>
      </div>
    </Container>
  );
}
