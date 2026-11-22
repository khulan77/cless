"use client";

import { Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { refundSale, resendVisitEmailAction } from "@/server/actions/pos";

const s = t.admin.sales;

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" /> {s.print}
    </Button>
  );
}

export function ResendEmailButton({ visitId }: { visitId: string }) {
  const router = useRouter();
  const a = useServerAction(resendVisitEmailAction);
  return (
    <Button size="sm" variant="secondary" disabled={a.pending} onClick={() => a.run(visitId, { onSuccess: () => router.refresh() })}>
      {s.resendEmail}
    </Button>
  );
}

type Line = { id: string; name: string; qty: number; refundedQty: number; lineTotal: number; kind: string };

/** Client-side estimate of a line's refund amount (the server recomputes it) */
function estimate(l: Line, q: number) {
  const cum = (n: number) => (n >= l.qty ? l.lineTotal : Math.floor((l.lineTotal * n) / l.qty));
  return cum(l.refundedQty + q) - cum(l.refundedQty);
}

export function RefundButton({ saleId, lines, methods }: { saleId: string; lines: Line[]; methods: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState(methods[0] ?? "CASH");
  const [restock, setRestock] = useState(true);
  const a = useServerAction(refundSale);
  const items = Object.entries(qty).filter(([, q]) => q > 0).map(([saleItemId, q]) => ({ saleItemId, qty: q }));
  const total = items.reduce((sum, i) => sum + estimate(lines.find((l) => l.id === i.saleItemId)!, i.qty), 0);

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        {s.refund}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={s.refundTitle}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(
              { saleId, items, reason, method: method as "CASH", restock },
              { onSuccess: () => (setOpen(false), setQty({}), setReason(""), router.refresh()) },
            );
          }}
        >
          <ul className="divide-y divide-line rounded-md border border-line">
            {lines.map((l) => {
              const left = l.qty - l.refundedQty;
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13.5px]">
                  <span className="min-w-0 truncate">{l.name}</span>
                  <Input
                    type="number"
                    min={0}
                    max={left}
                    disabled={left === 0}
                    aria-label={`${l.name} — ${s.refundQty(left)}`}
                    title={s.refundQty(left)}
                    value={qty[l.id] ?? 0}
                    onChange={(e) => setQty({ ...qty, [l.id]: Math.min(left, Math.max(0, Number(e.target.value) || 0)) })}
                    className="h-8 w-20 text-right"
                  />
                </li>
              );
            })}
          </ul>
          <Field label={s.refundReason} htmlFor="rf-reason" error={a.fieldErrors.reason}>
            <Textarea id="rf-reason" className="min-h-16" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label={s.refundMethod} htmlFor="rf-method">
            <Select id="rf-method" value={method} onChange={(e) => setMethod(e.target.value)}>
              {["CASH", "CARD", "QPAY", "TRANSFER"].map((m) => (
                <option key={m} value={m}>
                  {t.admin.payMethod[m as "CASH"]}
                </option>
              ))}
            </Select>
          </Field>
          {lines.some((l) => l.kind === "PRODUCT") && (
            <div>
              <Checkbox label={s.restock} checked={restock} onChange={(e) => setRestock(e.target.checked)} />
              <p className="mt-1 text-[12px] text-navy/50">{s.restockHint}</p>
            </div>
          )}
          <p className="text-[15px] font-medium tabular-nums">{s.refundTotal(formatMNT(total))}</p>
          <Button type="submit" variant="danger" className="w-full" disabled={a.pending || items.length === 0}>
            {s.submitRefund}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
