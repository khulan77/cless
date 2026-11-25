"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button, Input } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { previewAccountantAction, sendToAccountantAction } from "@/server/actions/accountant";

const A = t.admin.accountant;
type Preview = Extract<Awaited<ReturnType<typeof previewAccountantAction>>, { ok: true }>["data"];

/**
 * "Нягтланд илгээх": өдөр сонгоод → дүн, хүлээн авагчдыг харуулж баталгаажуулна → outbox.
 * Тухайн өдөр аль хэдийн илгээсэн бол "Дахин илгээх үү?" гэж дахин асууна.
 */
export function SendToAccountant({ defaultDay, maxDay }: { defaultDay: string; maxDay: string }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(defaultDay);
  const [data, setData] = useState<Preview | null>(null);
  const [confirmResend, setConfirmResend] = useState<string | null>(null);
  const preview = useServerAction(previewAccountantAction);
  const send = useServerAction(sendToAccountantAction);

  const load = (d: string) => {
    setDay(d);
    setData(null);
    setConfirmResend(null);
    void preview.run(d, { onSuccess: setData });
  };
  const close = () => {
    setOpen(false);
    setConfirmResend(null);
  };
  const submit = () =>
    send.run(
      { day, resend: confirmResend !== null },
      {
        onSuccess: (r) => {
          if (r.status === "confirm-resend") {
            const when = formatDateTime(new Date(r.previous.at));
            const by = r.previous.by ?? A.someone;
            setConfirmResend(r.previous.status === "PENDING" ? A.alreadyPending(when, by) : A.already(when, by));
            return;
          }
          toast.success(A.queued);
          close();
        },
      },
    );

  const noRecipients = data !== null && data.recipients.length === 0;
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
          load(day);
        }}
      >
        <Send className="size-4" strokeWidth={1.75} aria-hidden />
        {A.button}
      </Button>
      <ConfirmDialog
        open={open}
        title={A.title}
        confirmLabel={confirmResend ? A.resend : A.send}
        pending={send.pending}
        confirmDisabled={!data || noRecipients || preview.pending}
        onClose={close}
        onConfirm={() => void submit()}
      >
        <div className="space-y-4 text-[14px]">
          <label className="block">
            <span className="mb-1 block text-ink-soft">{A.day}</span>
            <Input type="date" value={day} max={maxDay} onChange={(e) => e.target.value && load(e.target.value)} className="w-48" />
          </label>
          {!data ? (
            <p className="text-ink-soft">…</p>
          ) : noRecipients ? (
            <p className="rounded-xl bg-warn-bg px-4 py-3 text-warn">
              {A.noRecipients}{" "}
              <Link href="/admin/settings/accountant" className="font-medium underline underline-offset-4">
                {A.setup}
              </Link>
            </p>
          ) : (
            <>
              <p>{A.confirmIntro(data.day)}</p>
              <div>
                <span className="mb-1 block text-ink-soft">{A.recipients}</span>
                <p className="break-all font-medium">{data.recipients.join(", ")}</p>
              </div>
              <table className="w-full border-collapse" data-testid="accountant-lines">
                <tbody>
                  {data.lines.map(([label, value]) => (
                    <tr key={label} className="border-b border-hairline last:border-0">
                      <td className="py-1.5 text-ink-soft">{label}</td>
                      <td className="py-1.5 text-right tabular-nums">{typeof value === "number" ? formatMNT(value) : value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.last && (
                <p className="flex flex-wrap items-center gap-2 text-ink-soft">
                  <Badge tone={data.last.status === "SENT" ? "green" : data.last.status === "FAILED" ? "red" : "neutral"}>{A.statusLabel[data.last.status]}</Badge>
                  {A.lastStatus(formatDateTime(new Date(data.last.at)))}
                </p>
              )}
              {confirmResend && <p className="rounded-xl bg-warn-bg px-4 py-3 font-medium text-warn">{confirmResend}</p>}
            </>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
