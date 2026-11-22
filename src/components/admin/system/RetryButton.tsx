"use client";

import { useRouter } from "next/navigation";
import { useServerAction } from "@/components/admin/use-action";
import { Button } from "@/components/admin/ui";
import { t } from "@/i18n";
import { retryOutboxJobAction } from "@/server/actions/system";

export function RetryButton({ id }: { id: string }) {
  const router = useRouter();
  const a = useServerAction(retryOutboxJobAction);
  return (
    <Button size="sm" variant="secondary" disabled={a.pending} onClick={() => a.run(id, { onSuccess: () => router.refresh() })}>
      {t.admin.system.retry}
    </Button>
  );
}
