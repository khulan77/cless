"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { GalleryUploader } from "@/components/admin/ImageUploader";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { Button, Card, Checkbox, Field, Input, Select, Textarea, inputClass } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { slugify } from "@/lib/slug";
import { BADGES, BADGE_LABELS, productInputSchema, type ProductInput, type VariantInput } from "@/lib/validation/product";
import { saveProduct } from "@/server/actions/products";

type CollectionOption = { id: string; name: string; kind: "CATEGORY" | "CONCERN" };

type Props = {
  initial: ProductInput;
  collections: CollectionOption[];
  /** Байгаа хувилбаруудын үлдэгдэл (зөвхөн харуулах) */
  stockByVariant?: Record<string, number>;
};

const emptyVariant = (): VariantInput => ({ sku: "", size: "", price: 0, costPrice: 0, lowStockAt: 3, isActive: true });

/** Формын state-д тоог string-ээр биш number-ээр хадгална; хоосон бол NaN → zod алдаа */
const num = (v: string) => (v === "" ? Number.NaN : Number(v));
const numValue = (v: number) => (Number.isNaN(v) ? "" : v);

export function ProductForm({ initial, collections, stockByVariant = {} }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ProductInput>(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const { run, pending, fieldErrors, setFieldErrors } = useServerAction(saveProduct);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setVariant = (i: number, patch: Partial<VariantInput>) =>
    set("variants", form.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const err = (path: string) => fieldErrors[path];

  const toggleCollection = (id: string, checked: boolean) =>
    set("collectionIds", checked ? [...form.collectionIds, id] : form.collectionIds.filter((c) => c !== id));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Client талд ижил schema-аар шалгана
    const parsed = productInputSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) (errors[issue.path.join(".") || "_"] ??= []).push(issue.message);
      setFieldErrors(errors);
      toast.error("Маягтын алдааг засна уу.");
      return;
    }
    await run(form, {
      onSuccess: ({ id }) => {
        if (!form.id) router.push(`/admin/products/${id}`);
        router.refresh();
      },
    });
  };

  const categories = collections.filter((c) => c.kind === "CATEGORY");
  const concerns = collections.filter((c) => c.kind === "CONCERN");

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]" noValidate>
      <div className="min-w-0 space-y-5">
        <Card title="Үндсэн мэдээлэл">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Нэр" htmlFor="name" error={err("name")}>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                }}
                aria-invalid={Boolean(err("name"))}
              />
            </Field>
            <Field label="Slug (URL)" htmlFor="slug" error={err("slug")} hint={`/products/${form.slug || "…"}`}>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase());
                }}
                aria-invalid={Boolean(err("slug"))}
              />
            </Field>
            <Field label="Ашиг тус (subtitle)" htmlFor="subtitle" error={err("subtitle")} hint='"/"-ээр тусгаарлана. Жишээ: Цэвэршүүлэх / Батга' className="md:col-span-2">
              <Input id="subtitle" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} aria-invalid={Boolean(err("subtitle"))} />
            </Field>
            <Field label="Тайлбар" htmlFor="description" error={err("description")} className="md:col-span-2">
              <Textarea id="description" rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} aria-invalid={Boolean(err("description"))} />
            </Field>
            <Field label="Хэрэглэх заавар" htmlFor="howToUse" error={err("howToUse")} className="md:col-span-2">
              <Textarea id="howToUse" rows={3} value={form.howToUse} onChange={(e) => set("howToUse", e.target.value)} aria-invalid={Boolean(err("howToUse"))} />
            </Field>
            <Field label="Найрлага" htmlFor="ingredients" error={err("ingredients")} hint="Заавал биш" className="md:col-span-2">
              <Textarea id="ingredients" rows={3} value={form.ingredients ?? ""} onChange={(e) => set("ingredients", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Зургууд">
          <GalleryUploader value={form.images} onChange={(v) => set("images", v)} folder="products" defaultAlt={form.name} />
          {err("images") && <p className="mt-2 text-[12px] text-red-600">{err("images")![0]}</p>}
        </Card>

        <Card
          title="Хувилбарууд"
          description="Үнэ, өртөг өөрчлөгдөхөд үнийн түүхэнд бичигдэнэ. Хадгалсан хувилбарыг устгахгүй — идэвхгүй болгоно."
          actions={
            <Button variant="secondary" size="sm" onClick={() => set("variants", [...form.variants, emptyVariant()])}>
              <Plus className="size-4" /> Мөр нэмэх
            </Button>
          }
        >
          {err("variants") && <p className="mb-3 text-[12px] text-red-600">{err("variants")![0]}</p>}
          <div className="-mx-5 -mb-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-[0.4px] text-navy/55">
                  <th className="px-3 py-2 pl-5 font-medium">SKU</th>
                  <th className="px-2 py-2 font-medium">Хэмжээ</th>
                  <th className="px-2 py-2 font-medium">Үнэ</th>
                  <th className="px-2 py-2 font-medium">Өртөг</th>
                  <th className="px-2 py-2 font-medium">Бага босго</th>
                  <th className="px-2 py-2 font-medium">Үлдэгдэл</th>
                  <th className="px-2 py-2 font-medium">Идэвхтэй</th>
                  <th className="px-2 py-2 pr-5"><span className="sr-only">Үйлдэл</span></th>
                </tr>
              </thead>
              <tbody>
                {form.variants.map((v, i) => {
                  const cell = (key: keyof VariantInput) => err(`variants.${i}.${key}`);
                  const cls = (key: keyof VariantInput) => `${inputClass} h-8 ${cell(key) ? "border-red-500" : ""}`;
                  return (
                    <tr key={v.id ?? `new-${i}`} className={`border-t border-line/60 align-top ${v.isActive ? "" : "bg-navy/[0.03] text-navy/50"}`}>
                      <td className="px-3 py-2 pl-5">
                        <input aria-label="SKU" value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })} className={`${cls("sku")} w-52 font-mono text-[12px]`} />
                        {cell("sku") && <p className="mt-1 text-[11px] text-red-600">{cell("sku")![0]}</p>}
                      </td>
                      <td className="px-2 py-2">
                        <input aria-label="Хэмжээ" value={v.size} onChange={(e) => setVariant(i, { size: e.target.value })} placeholder="30 мл" className={`${cls("size")} w-24`} />
                      </td>
                      <td className="px-2 py-2">
                        <MoneyInput aria-label="Үнэ" value={v.price} onChange={(price) => setVariant(i, { price })} invalid={Boolean(cell("price"))} className="h-8 w-36" />
                      </td>
                      <td className="px-2 py-2">
                        <MoneyInput aria-label="Өртөг" value={v.costPrice} onChange={(costPrice) => setVariant(i, { costPrice })} invalid={Boolean(cell("costPrice"))} className="h-8 w-36" />
                      </td>
                      <td className="px-2 py-2">
                        <input aria-label="Бага үлдэгдлийн босго" type="number" min={0} value={numValue(v.lowStockAt)} onChange={(e) => setVariant(i, { lowStockAt: num(e.target.value) })} className={`${cls("lowStockAt")} w-20 text-right`} />
                      </td>
                      <td className="px-2 py-2 pt-3.5 tabular-nums text-navy/60">{v.id ? (stockByVariant[v.id] ?? 0) : "—"}</td>
                      <td className="px-2 py-2 pt-3">
                        <input type="checkbox" aria-label="Идэвхтэй" checked={v.isActive} onChange={(e) => setVariant(i, { isActive: e.target.checked })} className="size-4 accent-navy" />
                      </td>
                      <td className="px-2 py-2 pr-5 text-right">
                        {!v.id && (
                          <button type="button" onClick={() => set("variants", form.variants.filter((_, j) => j !== i))} aria-label="Мөр хасах" className="rounded p-1.5 text-navy/50 hover:bg-red-50 hover:text-red-700">
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Төлөв">
          <div className="space-y-4">
            <Checkbox label="Дэлгүүрт нийтлэх" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
            <p className="-mt-2 text-[12px] text-navy/50">Унтраавал ноорог/архив болж сайтаас нуугдана.</p>
            <Field label="Badge" htmlFor="badge">
              <Select id="badge" value={form.badge ?? ""} onChange={(e) => set("badge", (e.target.value || null) as ProductInput["badge"])}>
                <option value="">Байхгүй</option>
                {BADGES.map((b) => (
                  <option key={b} value={b}>{BADGE_LABELS[b]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Эрэмбэ" htmlFor="sortOrder" error={err("sortOrder")} hint="Бага тоо эхэнд">
              <Input id="sortOrder" type="number" min={0} value={numValue(form.sortOrder)} onChange={(e) => set("sortOrder", num(e.target.value))} />
            </Field>
          </div>
        </Card>

        <Card title="Ангилал">
          <div className="flex flex-col gap-2">
            {categories.map((c) => (
              <Checkbox key={c.id} label={c.name} checked={form.collectionIds.includes(c.id)} onChange={(e) => toggleCollection(c.id, e.target.checked)} />
            ))}
          </div>
        </Card>

        <Card title="Арьсны асуудал">
          <div className="flex flex-col gap-2">
            {concerns.map((c) => (
              <Checkbox key={c.id} label={c.name} checked={form.collectionIds.includes(c.id)} onChange={(e) => toggleCollection(c.id, e.target.checked)} />
            ))}
          </div>
        </Card>

        <div className="sticky bottom-4 flex gap-2 rounded-lg border border-line bg-white p-3 shadow-sm">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/admin/products")}>
            Буцах
          </Button>
        </div>
      </div>
    </form>
  );
}
