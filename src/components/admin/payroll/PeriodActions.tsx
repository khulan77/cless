"use client";

import { Calculator, CheckCircle2, FileSpreadsheet, Landmark, RotateCcw, Wallet } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Field, Textarea, btnClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { approvePeriodAction, calculatePeriodAction, markPaidAction, unapprovePeriodAction } from "@/server/actions/payroll";

const P = t.admin.payroll.period;

export function PeriodActions({ id, status, calculated, hasLines, canWrite }: { id: string; status: "DRAFT" | "APPROVED" | "PAID"; calculated: boolean; hasLines: boolean; canWrite: boolean }) {
  const calc = useServerAction(calculatePeriodAction);
  const approve = useServerAction(approvePeriodAction);
  const unapprove = useServerAction(unapprovePeriodAction);
  const paid = useServerAction(markPaidAction);
  const [dlg, setDlg] = useState<null | "approve" | "unapprove" | "paid">(null);
  const [reason, setReason] = useState("");
  const close = () => setDlg(null);

  return (
    <div className="flex flex-wrap gap-2">
      {canWrite && status === "DRAFT" && (
        <>
          <Button variant={calculated ? "secondary" : "primary"} disabled={calc.pending} onClick={() => calc.run(id)}>
            <Calculator className="size-[18px]" /> {calculated ? P.recalculate : P.calculate}
          </Button>
          <Button disabled={!calculated || !hasLines} onClick={() => setDlg("approve")}>
            <CheckCircle2 className="size-[18px]" /> {P.approve}
          </Button>
        </>
      )}
      {canWrite && status === "APPROVED" && (
        <>
          <Button onClick={() => setDlg("paid")}><Wallet className="size-[18px]" /> {P.markPaid}</Button>
          <Button variant="secondary" onClick={() => setDlg("unapprove")}><RotateCcw className="size-[18px]" /> {P.unapprove}</Button>
        </>
      )}
      {hasLines && (
        <a href={`/api/admin/payroll/${id}/export.xlsx`} className={btnClass("secondary")}>
          <FileSpreadsheet className="size-[18px]" /> {P.exportExcel}
        </a>
      )}
      {canWrite && status !== "DRAFT" && (
        <a href={`/api/admin/payroll/${id}/bank.xlsx`} className={btnClass("secondary")}>
          <Landmark className="size-[18px]" /> {P.exportBank}
        </a>
      )}

      <ConfirmDialog open={dlg === "approve"} title={P.approve} confirmLabel={P.approve} pending={approve.pending} onClose={close} onConfirm={() => approve.run(id, { onSuccess: close })}>
        <p className="text-[15px]">{P.approveConfirm}</p>
      </ConfirmDialog>
      <ConfirmDialog open={dlg === "paid"} title={P.markPaid} confirmLabel={P.markPaid} pending={paid.pending} onClose={close} onConfirm={() => paid.run(id, { onSuccess: close })}>
        <p className="text-[15px]">{P.paidConfirm}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dlg === "unapprove"}
        danger
        title={P.unapprove}
        confirmLabel={P.unapprove}
        pending={unapprove.pending}
        confirmDisabled={reason.trim().length < 5}
        onClose={close}
        onConfirm={() => unapprove.run({ id, reason }, { onSuccess: () => { close(); setReason(""); } })}
      >
        <Field label={P.unapproveReason} htmlFor="unapprove-reason" error={unapprove.fieldErrors.reason}>
          <Textarea id="unapprove-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
