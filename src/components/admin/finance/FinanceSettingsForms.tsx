"use client";

import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button, Checkbox, Field, Input, Select } from "@/components/admin/ui";
import { saveExpenseCategoryAction, saveFinanceSettingsAction } from "@/server/actions/finance";

type Settings = { managerExpenses: boolean; managerFinance: boolean; opening: { asOf: string; cash: number; bank: number } | null };

export function FinanceSettingsForm({ initial, today }: { initial: Settings; today: string }) {
  const [managerExpenses, setME] = useState(initial.managerExpenses);
  const [managerFinance, setMF] = useState(initial.managerFinance);
  const [useOpening, setUseOpening] = useState(!!initial.opening);
  const [asOf, setAsOf] = useState(initial.opening?.asOf ?? today);
  const [cash, setCash] = useState(String(initial.opening?.cash ?? 0));
  const [bank, setBank] = useState(String(initial.opening?.bank ?? 0));
  const { run, pending, fieldErrors } = useServerAction(saveFinanceSettingsAction);
  const n = (v: string) => Number(v.replace(/[^\d-]/g, "")) || 0;
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run({ managerExpenses, managerFinance, opening: useOpening ? { asOf, cash: n(cash), bank: n(bank) } : null });
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-[14px] font-medium">Ресепшн (менежер)</legend>
        <Checkbox label="Зардлыг харах" checked={managerExpenses} onChange={(e) => setME(e.target.checked)} />
        <Checkbox label="Санхүүгийн тайланг харах" checked={managerFinance} onChange={(e) => setMF(e.target.checked)} />
        <p className="text-[13px] text-ink-soft">Зөвхөн харна — бүртгэх, засах эрх нь Админ, Нягтланд л. Анхдагч: хоёулаа үгүй.</p>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-[14px] font-medium">Мөнгөн гүйлгээний эхний үлдэгдэл</legend>
        <Checkbox label="Эхний үлдэгдэл тохируулах" checked={useOpening} onChange={(e) => setUseOpening(e.target.checked)} />
        {useOpening && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Огноо (тухайн өдрийн эхэнд)" htmlFor="op-date" error={fieldErrors["opening.asOf"]}>
              <Input id="op-date" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </Field>
            <Field label="Бэлэн (₮)" htmlFor="op-cash">
              <Input id="op-cash" inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} />
            </Field>
            <Field label="Данс (₮)" htmlFor="op-bank">
              <Input id="op-bank" inputMode="numeric" value={bank} onChange={(e) => setBank(e.target.value)} />
            </Field>
          </div>
        )}
      </fieldset>
      <Button type="submit" disabled={pending}>{pending ? "Хадгалж байна…" : "Хадгалах"}</Button>
    </form>
  );
}

type Cat = { id: string; code: string; name: string; kind: string; isSystem: boolean; isActive: boolean; sortOrder: number };
const KINDS = [
  ["UTILITY", "Ашиглалт (код заавал)"],
  ["INTERNET", "Интернэт (код заавал)"],
  ["OTHER", "Бусад"],
] as const;

export function CategoryRow({ c }: { c: Cat | null }) {
  const [code, setCode] = useState(c?.code ?? "");
  const [name, setName] = useState(c?.name ?? "");
  const [kind, setKind] = useState(c?.kind ?? "OTHER");
  const [active, setActive] = useState(c?.isActive ?? true);
  const { run, pending, fieldErrors } = useServerAction((input: Parameters<typeof saveExpenseCategoryAction>[1]) => saveExpenseCategoryAction(c?.id ?? null, input));
  return (
    <form
      className="grid items-end gap-2 border-b border-hairline py-3 sm:grid-cols-[110px_minmax(0,1fr)_200px_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          { code, name, kind: (c?.isSystem ? "OTHER" : kind) as "UTILITY" | "INTERNET" | "OTHER", isActive: active, sortOrder: c?.sortOrder ?? 50 },
          { onSuccess: () => { if (!c) { setCode(""); setName(""); } } },
        );
      }}
    >
      <Field label="Код (данс)" htmlFor={`cc-${c?.id ?? "new"}`} error={fieldErrors.code}>
        <Input id={`cc-${c?.id ?? "new"}`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength={20} className="font-mono" />
      </Field>
      <Field label="Нэр" htmlFor={`cn-${c?.id ?? "new"}`} error={fieldErrors.name}>
        <Input id={`cn-${c?.id ?? "new"}`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </Field>
      {c?.isSystem ? (
        <div className="pb-3"><Badge>Систем — цалингаас</Badge></div>
      ) : (
        <Field label="Төрөл" htmlFor={`ck-${c?.id ?? "new"}`}>
          <Select id={`ck-${c?.id ?? "new"}`} value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
      )}
      <div className="pb-2">{!c?.isSystem && <Checkbox label="Идэвхтэй" checked={active} onChange={(e) => setActive(e.target.checked)} />}</div>
      <Button type="submit" variant="secondary" disabled={pending}>{c ? "Хадгалах" : "Нэмэх"}</Button>
    </form>
  );
}
