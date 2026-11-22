"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { Button, Field, Input, Textarea } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { adjustStock, receiveStock } from "@/server/actions/stock";

const num = (v: string) => (v === "" ? Number.NaN : Number(v));

type Props = { variantId: string; label: string; stock: number; costPrice?: number };

export function StockActions({ variantId, label, stock, costPrice }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"receive" | "adjust" | null>(null);
  const receive = useServerAction(receiveStock);
  const adjust = useServerAction(adjustStock);

  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState(costPrice ? String(costPrice) : "");
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
        <Button size="sm" variant="secondary" onClick={() => setMode("receive")}>Орлого</Button>
        <Button size="sm" variant="ghost" onClick={() => { setNewQty(String(stock)); setMode("adjust"); }}>Тооллого</Button>
      </div>

      <Dialog open={mode === "receive"} onClose={close} title={`Орлого авах — ${label}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void receive.run(
              { variantId, qty: num(qty), unitCost: unitCost === "" ? null : num(unitCost), note: note || null },
              { onSuccess: done },
            );
          }}
        >
          <Field label="Тоо ширхэг" htmlFor="r-qty" error={receive.fieldErrors.qty}>
            <Input id="r-qty" type="number" min={1} autoFocus value={qty} onChange={(e) => setQty(e.target.value)} required />
          </Field>
          <Field label="Нэгжийн өртөг (₮)" htmlFor="r-cost" error={receive.fieldErrors.unitCost} hint="Заавал биш">
            <Input id="r-cost" type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </Field>
          <Field label="Тэмдэглэл" htmlFor="r-note" error={receive.fieldErrors.note}>
            <Textarea id="r-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Нийлүүлэгч, падааны дугаар…" />
          </Field>
          <p className="text-[13px] text-navy/60">
            Одоогийн үлдэгдэл: {stock} → {stock + (Number(qty) || 0)}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Болих</Button>
            <Button type="submit" disabled={receive.pending}>{receive.pending ? "Хадгалж байна…" : "Орлого авах"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={mode === "adjust"} onClose={close} title={`Тооллогын засвар — ${label}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void adjust.run({ variantId, newQty: num(newQty), reason }, { onSuccess: done });
          }}
        >
          <Field label="Тоолсон бодит тоо" htmlFor="a-qty" error={adjust.fieldErrors.newQty}>
            <Input id="a-qty" type="number" min={0} autoFocus value={newQty} onChange={(e) => setNewQty(e.target.value)} required />
          </Field>
          <Field label="Шалтгаан" htmlFor="a-reason" error={adjust.fieldErrors.reason}>
            <Textarea id="a-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Сарын тооллого, гэмтэл…" required />
          </Field>
          <p className="text-[13px] text-navy/60">
            Системд: {stock} · Зөрүү:{" "}
            <strong className="font-medium">
              {Number.isNaN(num(newQty)) ? "—" : `${num(newQty) - stock > 0 ? "+" : ""}${num(newQty) - stock}`}
            </strong>
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Болих</Button>
            <Button type="submit" disabled={adjust.pending}>{adjust.pending ? "Хадгалж байна…" : "Засвар хадгалах"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
