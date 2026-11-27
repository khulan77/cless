"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { Button, Field, Input, Select, Textarea } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { issueForServiceAction } from "@/server/actions/stock";

/**
 * «Үйлчилгээнд олгох» (PROMPT 27 §3): бүтээгдэхүүн, тоо (ширхэг / сав), гоо сайханч, тайлбар → үлдэгдлээс хасна.
 * appointmentId өгвөл тухайн цагт холбогдоно (үйлчилгээ, гоо сайханч автоматаар).
 */
export function ServiceUseButton({
  variantId,
  label,
  staff,
  appointmentId,
  defaultQty = 1,
  defaultStaffId,
  size = "sm",
  buttonLabel = "Үйлчилгээнд олгох",
  onDone,
}: {
  variantId: string;
  label: string;
  staff: { id: string; name: string }[];
  appointmentId?: string | null;
  defaultQty?: number;
  defaultStaffId?: string | null;
  size?: "sm" | "md";
  buttonLabel?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(defaultQty || 1));
  const [staffId, setStaffId] = useState(defaultStaffId ?? "");
  const [note, setNote] = useState("");
  const a = useServerAction(issueForServiceAction);
  return (
    <>
      <Button size={size} variant="ghost" onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Үйлчилгээнд олгох — ${label}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(
              { variantId, qty: Number(qty), appointmentId: appointmentId ?? null, staffId: staffId || null, note: note || null },
              { onSuccess: () => (setOpen(false), setNote(""), onDone?.(), router.refresh()) },
            );
          }}
        >
          <Field label="Тоо (ширхэг / сав)" htmlFor="su-qty" error={a.fieldErrors.qty}>
            <Input id="su-qty" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} required autoFocus className="max-w-32" />
          </Field>
          {!appointmentId && (
            <Field label="Гоо сайханч" htmlFor="su-staff">
              <Select id="su-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">—</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Тайлбар" htmlFor="su-note">
            <Textarea id="su-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Жишээ: нүүрний эмчилгээнд, сав нээсэн" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Болих
            </Button>
            <Button type="submit" disabled={a.pending}>
              {a.pending ? "Олгож байна…" : "Олгох"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
