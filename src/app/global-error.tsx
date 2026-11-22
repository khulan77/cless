"use client";

import { t } from "@/i18n";

/** Last-resort error page (root layout failed) — no app CSS is guaranteed, so inline styles */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="mn">
      <body style={{ fontFamily: "system-ui, sans-serif", color: "#0e2243", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, padding: 16, textAlign: "center" }}>
        <div>
          <p style={{ fontSize: 12, letterSpacing: 2, opacity: 0.6 }}>{t.serverError.code}</p>
          <h1 style={{ fontSize: 24, fontWeight: 400, margin: "8px 0" }}>{t.serverError.title}</h1>
          <p style={{ opacity: 0.7 }}>{t.serverError.text}</p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>{t.serverError.errorId(error.digest)}</p>}
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 20px", border: "1px solid #0e2243", borderRadius: 999, background: "#fff", cursor: "pointer" }}>
            {t.serverError.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
