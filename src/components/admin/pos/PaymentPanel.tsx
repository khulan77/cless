"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button, Field, Input, btnClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { posCancel, posCancelPayment, posCreatePayment, posUnlock, posVerifyPayment } from "@/server/actions/pos";
import type { PaymentView } from "@/server/modules/payments/service";

const p = t.admin.payment;
type Method = "CASH" | "CARD" | "QPAY" | "TRANSFER";

export type PaymentSale = { id: string; number: string; total: number; paidAmount: number; status: string };
export type PaymentRow = { id: string; method: string; amount: number; status: string; change: number | null; reviewReason: string | null };

const newKey = () => crypto.randomUUID();

export function PaymentPanel({
  sale: initial,
  payments: initialPayments,
  qpayMode,
  shiftOpen,
  canTransfer,
  onDone,
  onUnlocked,
}: {
  sale: PaymentSale;
  payments: PaymentRow[];
  qpayMode: "api" | "manual";
  shiftOpen: boolean;
  canTransfer: boolean;
  /** Start a new sale */
  onDone: () => void;
  /** Sale was unlocked for editing — reload the cart */
  onUnlocked: () => void;
}) {
  const [sale, setSale] = useState(initial);
  const [payments, setPayments] = useState(initialPayments);
  const remaining = Math.max(0, sale.total - sale.paidAmount - payments.filter((x) => x.status === "PROCESSING" || x.status === "PENDING").reduce((s, x) => s + x.amount, 0));
  const [method, setMethod] = useState<Method>(shiftOpen ? "CASH" : "CARD");
  const [amount, setAmount] = useState<number>(remaining);
  const [tendered, setTendered] = useState<number>(Number.NaN);
  const [approvalCode, setApprovalCode] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [ref, setRef] = useState("");
  const [qr, setQr] = useState<(NonNullable<PaymentView["qpay"]> & { paymentId: string }) | null>(null);
  const [lastChange, setLastChange] = useState<number | null>(null);
  const keyRef = useRef(newKey());

  const pay = useServerAction(posCreatePayment);
  const verify = useServerAction(posVerifyPayment);
  const cancelPay = useServerAction(posCancelPayment);
  const unlock = useServerAction(posUnlock);
  const cancelSale = useServerAction(posCancel);

  const paid = sale.status === "PAID";

  const apply = useCallback((v: PaymentView) => {
    setSale((s) => ({ ...s, status: v.sale.status, paidAmount: v.sale.paidAmount, total: v.sale.total }));
    setPayments((list) => {
      const row = { ...v.payment };
      return list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [...list, row];
    });
    if (v.payment.status !== "PROCESSING") setQr(null);
  }, []);

  // Reset the amount when the remaining balance changes (adjust state during render)
  const [prevRemaining, setPrevRemaining] = useState(remaining);
  if (prevRemaining !== remaining) {
    setPrevRemaining(remaining);
    setAmount(remaining);
  }

  // QPay QR: poll the DB every 3s and ask QPay every ~9s
  useEffect(() => {
    if (!qr) return;
    let n = 0;
    const id = setInterval(async () => {
      n++;
      try {
        const res = await fetch(`/api/pos/payments/${qr.paymentId}/status${n % 3 === 0 ? "?check=1" : ""}`, { cache: "no-store" });
        if (!res.ok) return;
        const v = (await res.json()) as PaymentView;
        apply(v);
        if (v.payment.status === "SUCCEEDED") toast.success(t.admin.payStatus.SUCCEEDED);
      } catch {
        // network error — retry on the next tick
      }
    }, 3000);
    return () => clearInterval(id);
  }, [qr, apply]);

  const submit = async () => {
    const base = { saleId: sale.id, amount, idempotencyKey: keyRef.current };
    const input =
      method === "CASH"
        ? { ...base, method, tendered: Number.isNaN(tendered) ? amount : tendered }
        : method === "CARD"
          ? { ...base, method, approvalCode, cardLast4: cardLast4 || null }
          : method === "TRANSFER"
            ? { ...base, method, externalRef: ref }
            : { ...base, method, externalRef: qpayMode === "manual" ? ref : null };
    const res = await pay.run(input);
    if (!res.ok) {
      // Validation errors may be retried with the same key; anything else gets a fresh key
      if (!res.fieldErrors) keyRef.current = newKey();
      return;
    }
    keyRef.current = newKey();
    apply(res.data);
    if (res.data.qpay && res.data.payment.status === "PROCESSING") setQr({ ...res.data.qpay, paymentId: res.data.payment.id });
    if (method === "CASH") setLastChange(res.data.payment.change);
    setTendered(Number.NaN);
    setApprovalCode("");
    setCardLast4("");
    setRef("");
  };

  if (paid) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden />
        <p className="text-[18px] font-medium">{p.success}</p>
        <p className="text-[28px] font-light tabular-nums">{formatMNT(sale.total)}</p>
        {lastChange !== null && lastChange > 0 && <p className="text-[16px] text-emerald-700">{p.changeDue(formatMNT(lastChange))}</p>}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link href={`/admin/sales/${sale.id}/receipt`} target="_blank" className={btnClass("secondary")}>
            {p.print}
          </Link>
          <Link href={`/admin/sales/${sale.id}`} className={btnClass("ghost")}>
            {p.view}
          </Link>
          <Button onClick={onDone} autoFocus>
            {t.admin.pos.newSale}
          </Button>
        </div>
      </div>
    );
  }

  const busy = pay.pending || verify.pending;
  const methods: Method[] = ["CASH", "CARD", "QPAY", ...(canTransfer ? (["TRANSFER"] as const) : [])];
  const changePreview = method === "CASH" && !Number.isNaN(tendered) ? tendered - amount : null;

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          [p.total, sale.total],
          [p.paid, sale.paidAmount],
          [p.remaining, sale.total - sale.paidAmount],
        ].map(([label, v]) => (
          <div key={label as string} className="rounded-md bg-navy/[0.04] px-2 py-2">
            <dt className="text-[12px] text-navy/55">{label}</dt>
            <dd className="text-[16px] font-medium tabular-nums">{formatMNT(v as number)}</dd>
          </div>
        ))}
      </dl>

      {qr ? (
        <div className="space-y-3 text-center">
          {qr.qrImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- QPay base64 PNG
            <img src={`data:image/png;base64,${qr.qrImage}`} alt="QPay QR" className="mx-auto size-56" />
          ) : (
            <p className="break-all font-mono text-[11px]">{qr.qrText}</p>
          )}
          <p className="text-[14px]">{p.waiting}</p>
          <p className="text-[12px] text-navy/55">{p.expiresAt(new Date(qr.expiresAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Ulaanbaatar", hour: "2-digit", minute: "2-digit" }))}</p>
          {qr.deeplinks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {qr.deeplinks.slice(0, 8).map((d) => (
                <a key={d.link} href={d.link} className="rounded border border-line px-2 py-1 text-[12px]">
                  {d.name}
                </a>
              ))}
            </div>
          )}
          <div className="flex justify-center gap-2">
            <Button variant="secondary" disabled={verify.pending} onClick={() => verify.run(qr.paymentId, { onSuccess: apply })}>
              {p.checkNow}
            </Button>
            <Button
              variant="danger"
              disabled={cancelPay.pending}
              onClick={() => cancelPay.run(qr.paymentId, { onSuccess: (v) => (apply(v), setQr(null)) })}
            >
              {p.cancelQr}
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          <div role="tablist" className={`grid gap-1 rounded-md bg-navy/[0.04] p-1 ${methods.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
            {methods.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={method === m}
                onClick={() => setMethod(m)}
                className={`h-9 rounded text-[14px] ${method === m ? "bg-white font-medium shadow-sm" : "text-navy/60"}`}
              >
                {t.admin.payMethod[m]}
              </button>
            ))}
          </div>

          {method === "CASH" && !shiftOpen && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              {t.admin.pos.shiftClosed}{" "}
              <Link href="/admin/shifts" className="underline">
                {t.admin.pos.openShift}
              </Link>
            </p>
          )}

          <Field label={p.amount} htmlFor="pay-amount" error={pay.fieldErrors.amount}>
            <MoneyInput id="pay-amount" className="w-full" value={amount} onChange={setAmount} autoFocus />
          </Field>

          {method === "CASH" && (
            <>
              <Field label={p.tendered} htmlFor="pay-tendered" error={pay.fieldErrors.tendered}>
                <MoneyInput id="pay-tendered" className="w-full" value={tendered} onChange={setTendered} />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                {[amount, 10_000, 20_000, 50_000, 100_000]
                  .map((step, i) => (i === 0 ? step : Math.ceil(amount / step) * step))
                  .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                  .map((v) => (
                    <Button key={v} size="sm" variant="secondary" onClick={() => setTendered(v)}>
                      {formatMNT(v)}
                    </Button>
                  ))}
              </div>
              {changePreview !== null && (
                <p className={`text-[16px] ${changePreview < 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {p.change}: <span className="tabular-nums">{formatMNT(Math.max(0, changePreview))}</span>
                </p>
              )}
            </>
          )}
          {method === "CARD" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={p.approvalCode} htmlFor="pay-approval" error={pay.fieldErrors.approvalCode}>
                <Input id="pay-approval" value={approvalCode} onChange={(e) => setApprovalCode(e.target.value)} autoComplete="off" />
              </Field>
              <Field label={`${p.cardLast4} (${p.optional})`} htmlFor="pay-last4" error={pay.fieldErrors.cardLast4}>
                <Input id="pay-last4" value={cardLast4} onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" />
              </Field>
            </div>
          )}
          {method === "QPAY" && qpayMode === "manual" && (
            <Field label={p.qpayRef} hint={p.qpayManualHint} htmlFor="pay-ref" error={pay.fieldErrors.externalRef}>
              <Input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" />
            </Field>
          )}
          {method === "TRANSFER" && (
            <Field label={p.transferRef} hint={p.transferHint} htmlFor="pay-ref" error={pay.fieldErrors.externalRef}>
              <Input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" />
            </Field>
          )}

          <Button type="submit" className="w-full" disabled={busy || !(amount > 0) || (method === "CASH" && !shiftOpen)}>
            {method === "QPAY" && qpayMode === "api" ? p.createQr : p.pay}
          </Button>
        </form>
      )}

      {payments.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.4px] text-navy/55">{p.history}</p>
          <ul className="divide-y divide-line rounded-md border border-line text-[13px]">
            {payments.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>{t.admin.payMethod[x.method as keyof typeof t.admin.payMethod] ?? x.method}</span>
                <span className="flex items-center gap-2">
                  {x.reviewReason && <Badge tone="amber">{p.review}</Badge>}
                  <Badge tone={x.status === "SUCCEEDED" ? "green" : x.status === "PROCESSING" ? "amber" : "neutral"}>
                    {t.admin.payStatus[x.status as keyof typeof t.admin.payStatus] ?? x.status}
                  </Badge>
                  <span className="tabular-nums">{formatMNT(x.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sale.paidAmount === 0 && !qr && (
        <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
          <Button variant="ghost" size="sm" disabled={unlock.pending} onClick={() => unlock.run(sale.id, { onSuccess: onUnlocked })}>
            {p.unlock}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={cancelSale.pending}
            onClick={() => window.confirm(p.confirmCancel) && cancelSale.run(sale.id, { onSuccess: onDone })}
          >
            {p.cancelSale}
          </Button>
        </div>
      )}
    </div>
  );
}
