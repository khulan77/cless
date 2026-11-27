"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Checkbox, Field, Input, Textarea } from "@/components/admin/ui";
import { formatMNT } from "@/lib/money";
import { savePackageSettingsAction, saveTemplateAction } from "@/server/actions/packages";

export type TemplateView = {
  id: string;
  name: string;
  description: string | null;
  serviceIds: string[];
  paidSessions: number;
  bonusSessions: number;
  price: number;
  validDays: number | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
};
type ServiceOpt = { id: string; name: string; price: number };

export function TemplateButton({ template, services, label }: { template?: TemplateView; services: ServiceOpt[]; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(template?.serviceIds ?? []);
  const [paid, setPaid] = useState(String(template?.paidSessions ?? 10));
  const [bonus, setBonus] = useState(String(template?.bonusSessions ?? 1));
  const [price, setPrice] = useState(template ? String(template.price) : "");
  const [validDays, setValidDays] = useState(template?.validDays ? String(template.validDays) : "365");
  const [isActive, setActive] = useState(template?.isActive ?? true);
  const [isPublic, setPublic] = useState(template?.isPublic ?? true);
  const a = useServerAction((input: Parameters<typeof saveTemplateAction>[1]) => saveTemplateAction(template?.id ?? null, input));

  const base = services.find((s) => s.id === serviceIds[0])?.price ?? 0;
  const suggested = base * (Number(paid) || 0);
  const total = (Number(paid) || 0) + (Number(bonus) || 0);
  const priceNum = price === "" ? suggested : Number(price);

  return (
    <>
      <Button variant={template ? "secondary" : "primary"} size={template ? "sm" : "md"} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={template ? "Багц засах" : "Шинэ багц"} wide>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            a.run(
              {
                name,
                description: description || null,
                serviceIds,
                paidSessions: Number(paid),
                bonusSessions: Number(bonus) || 0,
                price: price === "" ? null : Number(price),
                validDays: validDays === "" ? null : Number(validDays),
                isActive,
                isPublic,
                sortOrder: template?.sortOrder ?? 0,
              },
              { onSuccess: () => (setOpen(false), router.refresh()) },
            );
          }}
        >
          <Field label="Нэр" htmlFor="pk-name" error={a.fieldErrors.name} className="md:col-span-2">
            <Input id="pk-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Нүүрний эмчилгээ 10+1" required />
          </Field>
          <fieldset className="md:col-span-2">
            <legend className="mb-1.5 text-[14px] font-medium">Үйлчилгээ (1 эсвэл олон)</legend>
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-xl border border-hairline p-2 sm:grid-cols-2">
              {services.map((s) => (
                <Checkbox
                  key={s.id}
                  label={`${s.name} · ${formatMNT(s.price)}`}
                  checked={serviceIds.includes(s.id)}
                  onChange={(e) => setServiceIds((x) => (e.target.checked ? [...x, s.id] : x.filter((y) => y !== s.id)))}
                />
              ))}
            </div>
            {a.fieldErrors.serviceIds && <p className="mt-1 text-[13px] text-danger">{a.fieldErrors.serviceIds[0]}</p>}
          </fieldset>
          <Field label="Төлөх тоо" htmlFor="pk-paid" error={a.fieldErrors.paidSessions}>
            <Input id="pk-paid" type="number" min={1} value={paid} onChange={(e) => setPaid(e.target.value)} required />
          </Field>
          <Field label="Бонус" htmlFor="pk-bonus" hint={`Нийт ${total} удаа`}>
            <Input id="pk-bonus" type="number" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} />
          </Field>
          <Field label="Багцын үнэ (₮)" htmlFor="pk-price" hint={`Хоосон бол ${formatMNT(suggested)} (үйлчилгээний үнэ × төлөх тоо). 1 удаа ≈ ${formatMNT(total ? Math.floor(priceNum / total) : 0)}`} error={a.fieldErrors.price}>
            <Input id="pk-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder={String(suggested)} />
          </Field>
          <Field label="Хүчинтэй хоног" htmlFor="pk-days" hint="Хоосон = хугацаагүй">
            <Input id="pk-days" type="number" min={1} value={validDays} onChange={(e) => setValidDays(e.target.value)} />
          </Field>
          <Field label="Тайлбар" htmlFor="pk-desc" className="md:col-span-2">
            <Textarea id="pk-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-4 md:col-span-2">
            <Checkbox label="Идэвхтэй (POS-оор худалдана)" checked={isActive} onChange={(e) => setActive(e.target.checked)} />
            <Checkbox label="Сайтын /services дээр харуулах" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} />
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Болих</Button>
            <Button type="submit" disabled={a.pending}>{a.pending ? "Хадгалж байна…" : "Хадгалах"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function PackageSettingsForm({ initial }: { initial: { noShowConsumes: boolean; refundPenaltyPct: number } }) {
  const [noShow, setNoShow] = useState(initial.noShowConsumes);
  const [penalty, setPenalty] = useState(String(initial.refundPenaltyPct));
  const a = useServerAction(savePackageSettingsAction);
  return (
    <form
      className="flex flex-wrap items-end gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        a.run({ noShowConsumes: noShow, refundPenaltyPct: Number(penalty) || 0 });
      }}
    >
      <Checkbox label="«Ороогүй» цагт багцаас хасах" checked={noShow} onChange={(e) => setNoShow(e.target.checked)} />
      <Field label="Багц цуцлахад торгууль (%)" htmlFor="pk-pen" className="w-56">
        <Input id="pk-pen" type="number" min={0} max={100} value={penalty} onChange={(e) => setPenalty(e.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" disabled={a.pending}>Хадгалах</Button>
    </form>
  );
}
