"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { Button, Field, Input, Textarea } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { adjustStock, receiveStock } from "@/server/actions/stock";
import { t } from "@/i18n";

const num = (v: string) => (v === "" ? Number.NaN : Number(v));

type Props = { variantId: string; label: string; stock: number; costPrice?: number };

export function StockActions({ variantId, label, stock, costPrice }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"receive" | "adjust" | null>(null);
  const receive = useServerAction(receiveStock);
  const adjust = useServerAction(adjustStock);

  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState<number>(costPrice ?? Number.NaN);
  const [note, setNote] = useState("");
  const [newQty, setNewQty] = useState(String(stock));
  const [reason, setReason] = useState("");

  const close = () => {
    setMode(null);
    setQty("");
    setNote("");
    setReason("");
    receive.setFieldErrors({});
    adjust.setFieldErrors({});
  };
  const done = () => {
    close();
    router.refresh();
  };

  return (
    <>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => setMode("receive")}>{t.admin.stock.receive}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setNewQty(String(stock)); setMode("adjust"); }}>{t.admin.stock.adjust}</Button>
      </div>

      <Dialog open={mode === "receive"} onClose={close} title={t.admin.stock.receiveTitle(label)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void receive.run(
              { variantId, qty: num(qty), unitCost: Number.isNaN(unitCost) ? null : unitCost, note: note || null },
              { onSuccess: done },
            );
          }}
        >
          <Field label={t.admin.stock.qty} htmlFor="r-qty" error={receive.fieldErrors.qty}>
            <Input id="r-qty" type="number" min={1} autoFocus value={qty} onChange={(e) => setQty(e.target.value)} required />
          </Field>
          <Field label={t.admin.stock.unitCost} htmlFor="r-cost" error={receive.fieldErrors.unitCost} hint={t.admin.optional}>
            <MoneyInput id="r-cost" value={unitCost} onChange={setUnitCost} className="w-full" />
          </Field>
          <Field label={t.admin.stock.note} htmlFor="r-note" error={receive.fieldErrors.note}>
            <Textarea id="r-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.admin.stock.notePlaceholder} />
          </Field>
          <p className="text-[13px] text-navy/60">
            {t.admin.stock.current(stock, stock + (Number(qty) || 0))}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>{t.admin.cancel}</Button>
            <Button type="submit" disabled={receive.pending}>{receive.pending ? t.admin.saving : t.admin.stock.submitReceive}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={mode === "adjust"} onClose={close} title={t.admin.stock.adjustTitle(label)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void adjust.run({ variantId, newQty: num(newQty), reason }, { onSuccess: done });
          }}
        >
          <Field label={t.admin.stock.counted} htmlFor="a-qty" error={adjust.fieldErrors.newQty}>
            <Input id="a-qty" type="number" min={0} autoFocus value={newQty} onChange={(e) => setNewQty(e.target.value)} required />
          </Field>
          <Field label={t.admin.stock.reason} htmlFor="a-reason" error={adjust.fieldErrors.reason}>
            <Textarea id="a-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.admin.stock.reasonPlaceholder} required />
          </Field>
          <p className="text-[13px] text-navy/60">
            {t.admin.stock.diff(
              stock,
              Number.isNaN(num(newQty)) ? "—" : `${num(newQty) - stock > 0 ? "+" : ""}${num(newQty) - stock}`,
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>{t.admin.cancel}</Button>
            <Button type="submit" disabled={adjust.pending}>{adjust.pending ? t.admin.saving : t.admin.stock.submitAdjust}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
