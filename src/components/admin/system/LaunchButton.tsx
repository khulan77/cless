"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button } from "@/components/admin/ui";
import { t } from "@/i18n";
import { markLaunchedAction } from "@/server/actions/system";

const r = t.admin.readiness;

export function LaunchButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const a = useServerAction(() => markLaunchedAction());
  return (
    <>
      <Button onClick={() => setOpen(true)}>{r.launch}</Button>
      <ConfirmDialog
        open={open}
        title={r.launchTitle}
        confirmLabel={r.launch}
        pending={a.pending}
        onClose={() => setOpen(false)}
        onConfirm={() => a.run(undefined, { onSuccess: () => (setOpen(false), router.refresh()) })}
      >
        <p className="text-[14px]">{r.launchHint}</p>
      </ConfirmDialog>
    </>
  );
}
