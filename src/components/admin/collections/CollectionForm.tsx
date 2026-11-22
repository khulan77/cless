"use client";

import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SingleImageUploader } from "@/components/admin/ImageUploader";
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { t } from "@/i18n";
import { slugify } from "@/lib/slug";
import {
  COLLECTION_KIND_LABELS,
  collectionInputSchema,
  type CollectionInput,
  type CollectionTileInput,
} from "@/lib/validation/collection";
import { deleteCollection, saveCollection } from "@/server/actions/collections";

const F = t.admin.collectionForm;
const num = (v: string) => (v === "" ? Number.NaN : Number(v));

type ParentOption = { id: string; name: string; kind: "CATEGORY" | "CONCERN"; depth: number };

type Props = {
  initial: CollectionInput;
  parents: ParentOption[];
  products: { id: string; name: string }[];
  /** Products + children — deletion is blocked when > 0 */
  blockers?: number;
};

const emptyTile = (position: number): CollectionTileInput => ({
  position,
  image: "",
  eyebrow: "",
  title: "",
  text: "",
  ctaLabel: "",
  ctaHref: "",
});

export function CollectionForm({ initial, parents, products, blockers = 0 }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CollectionInput>(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const save = useServerAction(saveCollection);
  const del = useServerAction(deleteCollection);
  const dragFrom = useRef<number | null>(null);
  const set = <K extends keyof CollectionInput>(k: K, v: CollectionInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const err = (p: string) => save.fieldErrors[p];

  const names = new Map(products.map((p) => [p.id, p.name]));
  const order = form.productOrder;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id!);
    set("productOrder", next);
  };
  const setTile = (i: number, patch: Partial<CollectionTileInput>) =>
    set("tiles", form.tiles.map((tile, j) => (j === i ? { ...tile, ...patch } : tile)));

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
          toast.error(t.admin.fixFormErrors);
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
      <div className="min-w-0 space-y-5">
        <Card title={F.info}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t.admin.name} htmlFor="name" error={err("name")}>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                }}
              />
            </Field>
            <Field label={t.admin.slug} htmlFor="slug" error={err("slug")} hint={`/collections/${form.slug || "…"}`}>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase());
                }}
              />
            </Field>
            <Field label={F.kind} htmlFor="kind">
              <Select
                id="kind"
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as CollectionInput["kind"], parentId: null }))}
              >
                {Object.entries(COLLECTION_KIND_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label={F.parent} htmlFor="parentId" error={err("parentId")}>
              <Select id="parentId" value={form.parentId ?? ""} onChange={(e) => set("parentId", e.target.value || null)}>
                <option value="">{F.noParent}</option>
                {parents
                  .filter((p) => p.kind === form.kind && p.depth < 2)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{`${"— ".repeat(p.depth)}${p.name}`}</option>
                  ))}
              </Select>
            </Field>
            <Field label={F.heading} htmlFor="heading" error={err("heading")} hint={F.headingHint} className="md:col-span-2">
              <Input id="heading" value={form.heading ?? ""} onChange={(e) => set("heading", e.target.value)} />
            </Field>
            <Field label={F.intro} htmlFor="intro" error={err("intro")} hint={F.introHint} className="md:col-span-2">
              <Textarea id="intro" rows={2} value={form.intro ?? ""} onChange={(e) => set("intro", e.target.value)} />
            </Field>
            <Field label={F.seoText} htmlFor="seoText" error={err("seoText")} hint={F.seoTextHint} className="md:col-span-2">
              <Textarea id="seoText" rows={4} value={form.seoText ?? ""} onChange={(e) => set("seoText", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title={F.productOrder} description={F.productOrderHint}>
          {order.length === 0 ? (
            <p className="text-[14px] text-navy/60">{F.noProducts}</p>
          ) : (
            <ol className="divide-y divide-line/60 rounded-md border border-line">
              {order.map((id, i) => (
                <li
                  key={id}
                  draggable
                  onDragStart={() => (dragFrom.current = i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom.current !== null) move(dragFrom.current, i);
                    dragFrom.current = null;
                  }}
                  className="flex cursor-grab items-center gap-2 bg-white px-3 py-2 text-[13.5px] active:cursor-grabbing"
                >
                  <GripVertical className="size-4 text-navy/30" aria-hidden />
                  <span className="w-6 text-[12px] tabular-nums text-navy/45">{i + 1}.</span>
                  <span className="flex-1">{names.get(id) ?? id}</span>
                  <button type="button" aria-label={t.admin.productForm.moveUp} disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded p-1 hover:bg-navy/5 disabled:opacity-30">
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" aria-label={t.admin.productForm.moveDown} disabled={i === order.length - 1} onClick={() => move(i, i + 1)} className="rounded p-1 hover:bg-navy/5 disabled:opacity-30">
                    <ArrowDown className="size-4" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card
          title={F.tiles}
          description={F.tilesHint}
          actions={
            <Button variant="secondary" size="sm" onClick={() => set("tiles", [...form.tiles, emptyTile(8)])}>
              <Plus className="size-4" /> {F.addTile}
            </Button>
          }
        >
          <div className="space-y-4">
            {form.tiles.map((tile, i) => (
              <fieldset key={tile.id ?? `new-${i}`} className="grid gap-3 rounded-md border border-line p-4 md:grid-cols-[auto_1fr]">
                <div>
                  <SingleImageUploader value={tile.image || null} onChange={(v) => setTile(i, { image: v ?? "" })} folder="collections" />
                  {err(`tiles.${i}.image`) && <p className="mt-1 text-[12px] text-red-600">{err(`tiles.${i}.image`)![0]}</p>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={F.tilePosition} htmlFor={`tile-${i}-pos`} error={err(`tiles.${i}.position`)}>
                    <Input id={`tile-${i}-pos`} type="number" min={1} value={Number.isNaN(tile.position) ? "" : tile.position} onChange={(e) => setTile(i, { position: num(e.target.value) })} />
                  </Field>
                  <Field label={F.eyebrow} htmlFor={`tile-${i}-eyebrow`}>
                    <Input id={`tile-${i}-eyebrow`} value={tile.eyebrow ?? ""} onChange={(e) => setTile(i, { eyebrow: e.target.value })} />
                  </Field>
                  <Field label={t.admin.title} htmlFor={`tile-${i}-title`} error={err(`tiles.${i}.title`)} className="sm:col-span-2">
                    <Input id={`tile-${i}-title`} value={tile.title} onChange={(e) => setTile(i, { title: e.target.value })} />
                  </Field>
                  <Field label={t.admin.text} htmlFor={`tile-${i}-text`} className="sm:col-span-2">
                    <Input id={`tile-${i}-text`} value={tile.text ?? ""} onChange={(e) => setTile(i, { text: e.target.value })} />
                  </Field>
                  <Field label={F.ctaLabel} htmlFor={`tile-${i}-cta`}>
                    <Input id={`tile-${i}-cta`} value={tile.ctaLabel ?? ""} onChange={(e) => setTile(i, { ctaLabel: e.target.value })} />
                  </Field>
                  <Field label={F.ctaHref} htmlFor={`tile-${i}-href`} error={err(`tiles.${i}.ctaHref`)}>
                    <Input id={`tile-${i}-href`} value={tile.ctaHref ?? ""} onChange={(e) => setTile(i, { ctaHref: e.target.value })} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Button variant="danger" size="sm" onClick={() => set("tiles", form.tiles.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" /> {F.removeTile}
                    </Button>
                  </div>
                </div>
              </fieldset>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title={F.display}>
          <div className="space-y-4">
            <Checkbox label={F.showInMenu} checked={form.showInMenu} onChange={(e) => set("showInMenu", e.target.checked)} className="flex" />
            <Checkbox label={F.showOnHome} checked={form.showOnHome} onChange={(e) => set("showOnHome", e.target.checked)} className="flex" />
            <Field label={t.admin.sortOrder} htmlFor="sortOrder" error={err("sortOrder")} hint={t.admin.sortOrderHint}>
              <Input id="sortOrder" type="number" min={0} value={Number.isNaN(form.sortOrder) ? "" : form.sortOrder} onChange={(e) => set("sortOrder", num(e.target.value))} />
            </Field>
          </div>
        </Card>
        <Card title={F.banner}>
          <SingleImageUploader value={form.bannerImage} onChange={(v) => set("bannerImage", v)} folder="collections" label={F.banner} />
        </Card>
        <Card title={F.tile}>
          <SingleImageUploader value={form.tileImage} onChange={(v) => set("tileImage", v)} folder="collections" label={F.tile} />
        </Card>
        <div className="flex gap-2 rounded-lg border border-line bg-white p-3">
          <Button type="submit" disabled={save.pending} className="flex-1">
            {save.pending ? t.admin.saving : t.admin.save}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/admin/collections")}>
            {t.admin.back}
          </Button>
        </div>
        {form.id && (
          <Button
            variant="danger"
            className="w-full"
            disabled={del.pending || blockers > 0}
            title={blockers > 0 ? F.deleteBlocked : undefined}
            onClick={async () => {
              if (!confirm(F.deleteConfirm(form.name))) return;
              await del.run(form.id!, { onSuccess: () => router.push("/admin/collections") });
            }}
          >
            {blockers > 0 ? F.deleteWithCount(blockers) : t.admin.delete}
          </Button>
        )}
      </div>
    </form>
  );
}
