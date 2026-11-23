"use client";

import { CheckCircle2 } from "lucide-react";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { submitInquiryAction } from "@/server/actions/inquiries";
import { ContactButtons } from "./ContactActions";
import { useStorefront } from "./StorefrontContext";

export type InquiryProduct = { variantId: string; name: string; size: string | null; price: number };

const field = "mt-1.5 block w-full rounded-none border-b border-navy/30 bg-transparent py-2 text-[16px] focus:border-navy focus:outline-none";
const labelCls = "text-micro text-muted";

/**
 * "Салонд захиалах": call / DM buttons + a hold request (no stock lock — reception calls back).
 * `children` renders the trigger; it receives the open() callback.
 */
export function InquirySheet({ product, trigger }: { product: InquiryProduct; trigger: (open: () => void) => ReactNode }) {
  const { salon } = useStorefront();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const id = useId();
  const hasContact = Boolean(salon.phone || salon.instagram || salon.messenger);

  const submit = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    setError(null);
    start(async () => {
      const res = await submitInquiryAction({
        name: String(fd.get("name") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        note: String(fd.get("note") ?? ""),
        website: String(fd.get("website") ?? ""),
        items: [{ variantId: product.variantId, qty }],
      });
      if (res.ok) {
        setDone(res.data.message);
        setFieldErrors({});
      } else {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  };
  const err = (k: string) => fieldErrors[k]?.[0];

  return (
    <>
      {trigger(() => {
        setDone(null);
        setOpen(true);
      })}
      <Sheet open={open} onClose={() => setOpen(false)} title={t.inquiry.title} closeLabel={t.salon.close}>
        {done ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto size-10 text-navy" strokeWidth={1.25} aria-hidden />
            <p role="status" className="mt-4 text-[16px]">
              {done}
            </p>
            <button type="button" onClick={() => setOpen(false)} className="mt-8 min-h-12 w-full rounded-full border border-navy text-[14px]">
              {t.salon.close}
            </button>
          </div>
        ) : (
          <>
            <p className="mb-5 text-[14px] text-muted">{t.inquiry.intro}</p>
            {hasContact && (
              <>
                <ContactButtons salon={salon} />
                <div className="my-6 flex items-center gap-3 text-[12px] text-muted" aria-hidden>
                  <span className="h-px flex-1 bg-line" />
                  {t.inquiry.or}
                  <span className="h-px flex-1 bg-line" />
                </div>
              </>
            )}
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submit(e.currentTarget);
              }}
              className="space-y-5"
              aria-labelledby={`${id}-title`}
            >
              <h3 id={`${id}-title`} className="text-[15px] font-medium">
                {t.inquiry.formTitle}
              </h3>
              <div className="flex items-end justify-between gap-4 bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className={labelCls}>{t.inquiry.item}</p>
                  <p className="text-product mt-1 text-[14px]">
                    {product.name}
                    {product.size && <span className="text-muted"> · {product.size}</span>}
                  </p>
                  <p className="text-[13px] text-muted">{formatMNT(product.price)}</p>
                </div>
                <label className="shrink-0">
                  <span className={labelCls}>{t.inquiry.qty}</span>
                  <select value={qty} onChange={(e) => setQty(Number(e.target.value))} className="mt-1 block min-h-11 bg-transparent text-[16px]">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <label htmlFor={`${id}-name`} className={labelCls}>
                  {t.inquiry.name}
                </label>
                <input id={`${id}-name`} name="name" required autoComplete="name" className={field} aria-invalid={!!err("name")} aria-describedby={err("name") ? `${id}-name-err` : undefined} />
                {err("name") && (
                  <p id={`${id}-name-err`} className="mt-1 text-[13px] text-red-700">
                    {err("name")}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor={`${id}-phone`} className={labelCls}>
                  {t.inquiry.phone}
                </label>
                <input
                  id={`${id}-phone`}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  required
                  autoComplete="tel"
                  placeholder="9911 2233"
                  className={field}
                  aria-invalid={!!err("phone")}
                  aria-describedby={`${id}-phone-hint`}
                />
                <p id={`${id}-phone-hint`} className={`mt-1 text-[13px] ${err("phone") ? "text-red-700" : "text-muted"}`}>
                  {err("phone") ?? t.inquiry.phoneHint}
                </p>
              </div>
              <div>
                <label htmlFor={`${id}-note`} className={labelCls}>
                  {t.inquiry.note}
                </label>
                <textarea id={`${id}-note`} name="note" rows={2} maxLength={500} className={`${field} resize-none`} />
              </div>
              {/* Honeypot: hidden from people and assistive tech */}
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  {t.inquiry.honeypot}
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {error && (
                <p role="alert" className="text-[14px] text-red-700">
                  {error}
                </p>
              )}
              <button type="submit" disabled={pending} className="min-h-12 w-full rounded-full bg-navy text-[15px] text-white hover:bg-navy/90 disabled:opacity-60">
                {pending ? t.inquiry.sending : t.inquiry.submit}
              </button>
            </form>
          </>
        )}
      </Sheet>
    </>
  );
}
