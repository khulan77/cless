"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Dialog } from "@/components/admin/Dialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Checkbox, Field, IconButton, Input, Select, Textarea } from "@/components/admin/ui";
import { formatMNT } from "@/lib/money";
import { createExpenseAction, deleteExpenseAction, updateExpenseAction } from "@/server/actions/finance";

export type CategoryOption = { id: string; code: string; name: string; kind: string; isSystem: boolean };
export type ExpenseView = {
  id: string;
  date: string;
  categoryId: string;
  amount: number;
  vatIncluded: boolean;
  reference: string | null;
  vendor: string | null;
  note: string | null;
  paidVia: string | null;
  hasReceipt: boolean;
};

const PAID_VIA = [
  ["", "—"],
  ["CASH", "Бэлэн"],
  ["TRANSFER", "Данс (шилжүүлэг)"],
  ["CARD", "Карт"],
  ["QPAY", "QPay"],
] as const;
const REF_REQUIRED = ["UTILITY", "INTERNET"];

/** НӨАТ (10%) НӨАТ-тэй дүнгээс — сервертэй ижил томьёо (vatOf) */
const vatOf = (amount: number) => Math.round((amount * 1000) / 11_000);

export function NewExpenseButton({ categories, lastRefs, today }: { categories: CategoryOption[]; lastRefs: Record<string, { reference: string | null; vendor: string | null }>; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-[18px]" strokeWidth={2} /> Зардал бүртгэх
      </Button>
      {open && <ExpenseDialog categories={categories} lastRefs={lastRefs} today={today} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ExpenseRowActions({ expense, categories, lastRefs, today }: { expense: ExpenseView; categories: CategoryOption[]; lastRefs: Record<string, { reference: string | null; vendor: string | null }>; today: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const remove = useServerAction(deleteExpenseAction);
  return (
    <span className="flex justify-end gap-1">
      <IconButton label="Засах" onClick={() => setEdit(true)}>
        <Pencil className="size-4" />
      </IconButton>
      <IconButton label="Устгах" onClick={() => setDel(true)}>
        <Trash2 className="size-4" />
      </IconButton>
      {edit && <ExpenseDialog expense={expense} categories={categories} lastRefs={lastRefs} today={today} onClose={() => setEdit(false)} />}
      <ConfirmDialog
        open={del}
        title="Зардлыг устгах уу?"
        confirmLabel="Устгах"
        danger
        pending={remove.pending}
        onClose={() => setDel(false)}
        onConfirm={() => remove.run(expense.id, { onSuccess: () => (setDel(false), router.refresh()) })}
      >
        <p className="text-[14px]">
          {expense.date} · {formatMNT(expense.amount)}. Устгасныг AuditLog-д бүртгэнэ.
        </p>
      </ConfirmDialog>
    </span>
  );
}

function ExpenseDialog({
  expense,
  categories,
  lastRefs,
  today,
  onClose,
}: {
  expense?: ExpenseView;
  categories: CategoryOption[];
  lastRefs: Record<string, { reference: string | null; vendor: string | null }>;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const manual = categories.filter((c) => !c.isSystem);
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? manual[0]?.id ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [vatIncluded, setVatIncluded] = useState(expense?.vatIncluded ?? false);
  const [reference, setReference] = useState(expense?.reference ?? lastRefs[categoryId]?.reference ?? "");
  const [vendor, setVendor] = useState(expense?.vendor ?? lastRefs[categoryId]?.vendor ?? "");
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const create = useServerAction(createExpenseAction);
  const update = useServerAction((fd: FormData) => updateExpenseAction(expense!.id, fd));
  const a = expense ? update : create;
  const cat = categories.find((c) => c.id === categoryId);
  const refRequired = !!cat && REF_REQUIRED.includes(cat.kind);
  const n = Number(amount) || 0;

  const pickCategory = (id: string) => {
    setCategoryId(id);
    // Ангилал бүрт сүүлд ашигласан код, нийлүүлэгчийг санал болгоно (хоосон бол)
    if (!reference && lastRefs[id]?.reference) setReference(lastRefs[id]!.reference!);
    if (!vendor && lastRefs[id]?.vendor) setVendor(lastRefs[id]!.vendor!);
  };

  return (
    <Dialog open onClose={onClose} title={expense ? "Зардал засах" : "Зардал бүртгэх"} wide>
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("vatIncluded", vatIncluded ? "true" : "false");
          if (removeReceipt) fd.set("removeReceipt", "1");
          a.run(fd, { onSuccess: () => (onClose(), router.refresh()) });
        }}
      >
        <Field label="Ангилал" htmlFor="exp-cat" error={a.fieldErrors.categoryId}>
          <Select id="exp-cat" name="categoryId" value={categoryId} onChange={(e) => pickCategory(e.target.value)} required>
            {manual.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Огноо" htmlFor="exp-date" error={a.fieldErrors.date}>
          <Input id="exp-date" name="date" type="date" required defaultValue={expense?.date ?? today} />
        </Field>
        <Field label="Дүн (₮, НӨАТ-тэй нийт)" htmlFor="exp-amount" error={a.fieldErrors.amount}>
          <Input id="exp-amount" name="amount" inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
        <div className="flex flex-col justify-end gap-1 pb-1">
          <Checkbox label="НӨАТ-тэй (10%)" checked={vatIncluded} onChange={(e) => setVatIncluded(e.target.checked)} />
          {vatIncluded && n > 0 && (
            <p className="text-[13px] text-ink-soft tabular-nums">
              Цэвэр {formatMNT(n - vatOf(n))} · НӨАТ {formatMNT(vatOf(n))}
            </p>
          )}
        </div>
        <Field
          label={refRequired ? "Төлбөрийн код (заавал)" : "Төлбөрийн код"}
          htmlFor="exp-ref"
          error={a.fieldErrors.reference}
          hint={lastRefs[categoryId]?.reference ? `Сүүлд: ${lastRefs[categoryId]!.reference}` : "Хэрэглэгчийн код, гэрээний №, нэхэмжлэхийн №"}
        >
          <Input id="exp-ref" name="reference" required={refRequired} maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Нийлүүлэгч" htmlFor="exp-vendor" hint="УБЦТС, Univision г.м.">
          <Input id="exp-vendor" name="vendor" maxLength={120} value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </Field>
        <Field label="Төлсөн" htmlFor="exp-paid">
          <Select id="exp-paid" name="paidVia" defaultValue={expense?.paidVia ?? ""}>
            {PAID_VIA.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Баримт (зураг / PDF, 4MB хүртэл)" htmlFor="exp-receipt" error={a.fieldErrors.receipt}>
          <Input id="exp-receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
          {expense?.hasReceipt && (
            <span className="mt-1 flex items-center gap-3 text-[13px]">
              <a href={`/api/admin/expenses/${expense.id}/receipt`} target="_blank" rel="noreferrer" className="underline">
                Одоогийн баримт
              </a>
              <Checkbox label="Устгах" checked={removeReceipt} onChange={(e) => setRemoveReceipt(e.target.checked)} />
            </span>
          )}
        </Field>
        <Field label="Тайлбар" htmlFor="exp-note" className="md:col-span-2">
          <Textarea id="exp-note" name="note" rows={2} maxLength={500} defaultValue={expense?.note ?? ""} />
        </Field>
        <div className="flex justify-end gap-2 md:col-span-2">
          <Button variant="secondary" onClick={onClose}>
            Болих
          </Button>
          <Button type="submit" disabled={a.pending}>
            {a.pending ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
