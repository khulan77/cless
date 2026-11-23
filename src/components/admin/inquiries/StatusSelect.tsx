"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { t } from "@/i18n";
import { setInquiryStatusAction } from "@/server/actions/inquiries";

const STATUSES = ["NEW", "CONTACTED", "DONE", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

export function InquiryStatusSelect({ id, status }: { id: string; status: Status }) {
  const router = useRouter();
  const a = useServerAction(setInquiryStatusAction);
  return (
    <Select
      aria-label={t.admin.inquiries.changeStatus}
      value={status}
      disabled={a.pending}
      onChange={(e) => void a.run({ id, status: e.target.value as Status }, { onSuccess: () => router.refresh() })}
      className="min-w-36"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t.admin.inquiries.status[s]}
        </option>
      ))}
    </Select>
  );
}
