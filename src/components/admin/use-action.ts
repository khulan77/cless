"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { t } from "@/i18n";

/**
 * Calls a Server Action, shows the result as a toast and exposes field errors.
 */
export function useServerAction<I, T>(action: (input: I) => Promise<ActionResult<T>>) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const run = (input: I, opts: { onSuccess?: (data: T) => void; success?: string } = {}) =>
    new Promise<ActionResult<T>>((resolve) => {
      startTransition(async () => {
        try {
          const res = await action(input);
          if (res.ok) {
            setFieldErrors({});
            const msg = res.message ?? opts.success;
            if (msg) toast.success(msg);
            opts.onSuccess?.(res.data);
          } else {
            setFieldErrors(res.fieldErrors ?? {});
            toast.error(res.error);
          }
          resolve(res);
        } catch {
          // e.g. network failure
          toast.error(t.admin.networkError);
          resolve({ ok: false, error: "network" });
        }
      });
    });

  return { run, pending, fieldErrors, setFieldErrors };
}
