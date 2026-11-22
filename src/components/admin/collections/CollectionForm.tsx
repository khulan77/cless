"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SingleImageUploader } from "@/components/admin/ImageUploader";
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { slugify } from "@/lib/slug";
import { COLLECTION_KIND_LABELS, NAV_GROUPS, collectionInputSchema, type CollectionInput } from "@/lib/validation/collection";
import { deleteCollection, saveCollection } from "@/server/actions/collections";

const num = (v: string) => (v === "" ? Number.NaN : Number(v));

export function CollectionForm({ initial, productCount = 0 }: { initial: CollectionInput; productCount?: number }) {
  const router = useRouter();
  const [form, setForm] = useState<CollectionInput>(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const save = useServerAction(saveCollection);
  const del = useServerAction(deleteCollection);
  const set = <K extends keyof CollectionInput>(k: K, v: CollectionInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const err = (p: string) => save.fieldErrors[p];

  return (
    <form
      noValidate
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = collectionInputSchema.safeParse(form);
        if (!parsed.success) {
          const errors: Record<string, string[]> = {};
          for (const i of parsed.error.issues) (errors[i.path.join(".") || "_"] ??= []).push(i.message);
          save.setFieldErrors(errors);
          toast.error("Маягтын алдааг засна уу.");
          return;
        }
        await save.run(form, {
          onSuccess: ({ id }) => {
            if (!form.id) router.push(`/admin/collections/${id}`);
            router.refresh();
          },
        });
      }}
    >
      <Card title="Мэдээлэл">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Нэр" htmlFor="name" error={err("name")}>
            <Input id="name" value={form.name} onChange={(e) => { const name = e.target.value; setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) })); }} />
          </Field>
          <Field label="Slug" htmlFor="slug" error={err("slug")} hint={`/collections/${form.slug || "…"}`}>
            <Input id="slug" value={form.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} />
          </Field>
          <Field label="Төрөл" htmlFor="kind">
            <Select id="kind" value={form.kind} onChange={(e) => set("kind", e.target.value as CollectionInput["kind"])}>
              {Object.entries(COLLECTION_KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Цэсний бүлэг" htmlFor="navGroup" hint="Сайтын цэсэнд аль хэсэгт харагдах">
            <Select id="navGroup" value={form.navGroup ?? ""} onChange={(e) => set("navGroup", (e.target.value || null) as CollectionInput["navGroup"])}>
              <option value="">Цэсэнд харуулахгүй</option>
              {Object.entries(NAV_GROUPS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Тайлбар" htmlFor="description" className="md:col-span-2">
            <Textarea id="description" rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      </Card>
      <div className="space-y-5">
        <Card title="Нүүр хуудас">
          <div className="space-y-4">
            <Checkbox label="Нүүр хуудсанд харуулах" checked={form.showOnHome} onChange={(e) => set("showOnHome", e.target.checked)} />
            <Field label="Эрэмбэ" htmlFor="sortOrder" error={err("sortOrder")} hint="Бага тоо эхэнд">
              <Input id="sortOrder" type="number" min={0} value={Number.isNaN(form.sortOrder) ? "" : form.sortOrder} onChange={(e) => set("sortOrder", num(e.target.value))} />
            </Field>
            <SingleImageUploader value={form.image} onChange={(v) => set("image", v)} folder="collections" />
          </div>
        </Card>
        <div className="flex gap-2 rounded-lg border border-line bg-white p-3">
          <Button type="submit" disabled={save.pending} className="flex-1">{save.pending ? "Хадгалж байна…" : "Хадгалах"}</Button>
          <Button variant="secondary" onClick={() => router.push("/admin/collections")}>Буцах</Button>
        </div>
        {form.id && (
          <Button
            variant="danger"
            className="w-full"
            disabled={del.pending || productCount > 0}
            title={productCount > 0 ? "Бүтээгдэхүүнд холбогдсон тул устгах боломжгүй" : undefined}
            onClick={async () => {
              if (!confirm(`"${form.name}" ангиллыг устгах уу?`)) return;
              await del.run(form.id!, { onSuccess: () => router.push("/admin/collections") });
            }}
          >
            Устгах {productCount > 0 && `(${productCount} бүтээгдэхүүнтэй)`}
          </Button>
        )}
      </div>
    </form>
  );
}
