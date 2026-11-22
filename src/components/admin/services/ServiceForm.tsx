"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SingleImageUploader } from "@/components/admin/ImageUploader";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { Button, Card, Checkbox, Field, Input, Textarea, inputClass } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { slugify } from "@/lib/slug";
import { serviceInputSchema, type ServiceInput } from "@/lib/validation/service";
import { saveService } from "@/server/actions/services";
import { VariantPicker } from "./VariantPicker";

const num = (v: string) => (v === "" ? Number.NaN : Number(v));
const numValue = (v: number) => (Number.isNaN(v) ? "" : v);

type Props = { initial: ServiceInput; variantLabels: Record<string, string> };

export function ServiceForm({ initial, variantLabels: initialLabels }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ServiceInput>(initial);
  const [labels, setLabels] = useState(initialLabels);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const { run, pending, fieldErrors, setFieldErrors } = useServerAction(saveService);
  const set = <K extends keyof ServiceInput>(k: K, v: ServiceInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const err = (p: string) => fieldErrors[p];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = serviceInputSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const i of parsed.error.issues) (errors[i.path.join(".") || "_"] ??= []).push(i.message);
      setFieldErrors(errors);
      toast.error("Маягтын алдааг засна уу.");
      return;
    }
    await run(form, {
      onSuccess: ({ id }) => {
        if (!form.id) router.push(`/admin/services/${id}`);
        router.refresh();
      },
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <Card title="Үндсэн мэдээлэл">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Нэр" htmlFor="name" error={err("name")}>
              <Input id="name" value={form.name} onChange={(e) => { const name = e.target.value; setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) })); }} />
            </Field>
            <Field label="Slug" htmlFor="slug" error={err("slug")}>
              <Input id="slug" value={form.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} />
            </Field>
            <Field label="Хугацаа (минут)" htmlFor="durationMin" error={err("durationMin")}>
              <Input id="durationMin" type="number" min={5} step={5} value={numValue(form.durationMin)} onChange={(e) => set("durationMin", num(e.target.value))} />
            </Field>
            <Field label="Үнэ" htmlFor="price" error={err("price")}>
              <MoneyInput id="price" value={form.price} onChange={(v) => set("price", v)} invalid={Boolean(err("price"))} className="w-full" />
            </Field>
            <Field label="Тайлбар" htmlFor="description" error={err("description")} className="md:col-span-2">
              <Textarea id="description" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Өртгийн тэмдэглэл" htmlFor="costNote" hint="Дотоод тэмдэглэл, сайтад харагдахгүй" className="md:col-span-2">
              <Textarea id="costNote" rows={2} value={form.costNote ?? ""} onChange={(e) => set("costNote", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Орц" description="1 үйлчилгээнд зарцуулагдах савны хэсэг. 0.1 = нэг савны 10%.">
          <VariantPicker
            exclude={form.consumables.map((c) => c.variantId)}
            onSelect={(o) => {
              setLabels((l) => ({ ...l, [o.id]: `${o.label} (${o.sku})` }));
              set("consumables", [...form.consumables, { variantId: o.id, qtyPerService: 0.05 }]);
            }}
          />
          {form.consumables.length > 0 && (
            <ul className="mt-4 divide-y divide-line/60 rounded-md border border-line">
              {form.consumables.map((c, i) => (
                <li key={c.variantId} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-[13.5px]">{labels[c.variantId] ?? c.variantId}</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0.01}
                    aria-label="Савны хэсэг"
                    value={numValue(c.qtyPerService)}
                    onChange={(e) => set("consumables", form.consumables.map((x, j) => (j === i ? { ...x, qtyPerService: num(e.target.value) } : x)))}
                    className={`${inputClass} h-8 w-24 text-right ${err(`consumables.${i}.qtyPerService`) ? "border-red-500" : ""}`}
                  />
                  <span className="w-12 text-[12px] text-navy/50">{Number.isNaN(c.qtyPerService) ? "" : `${Math.round(c.qtyPerService * 1000) / 10}%`}</span>
                  <button type="button" onClick={() => set("consumables", form.consumables.filter((_, j) => j !== i))} aria-label="Орц хасах" className="rounded p-1.5 text-navy/50 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Төлөв">
          <div className="space-y-4">
            <Checkbox label="Идэвхтэй" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            <p className="-mt-2 text-[12px] text-navy/50">Идэвхгүй болговол архивлагдана (устгахгүй).</p>
            <Field label="Эрэмбэ" htmlFor="sortOrder" error={err("sortOrder")}>
              <Input id="sortOrder" type="number" min={0} value={numValue(form.sortOrder)} onChange={(e) => set("sortOrder", num(e.target.value))} />
            </Field>
          </div>
        </Card>
        <Card title="Зураг">
          <SingleImageUploader value={form.image} onChange={(v) => set("image", v)} folder="services" />
        </Card>
        <div className="sticky bottom-4 flex gap-2 rounded-lg border border-line bg-white p-3 shadow-sm">
          <Button type="submit" disabled={pending} className="flex-1">{pending ? "Хадгалж байна…" : "Хадгалах"}</Button>
          <Button variant="secondary" onClick={() => router.push("/admin/services")}>Буцах</Button>
        </div>
      </div>
    </form>
  );
}
