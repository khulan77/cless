"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { GalleryUploader } from "@/components/admin/ImageUploader";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { SearchPicker } from "@/components/admin/SearchPicker";
import { VariantPicker } from "@/components/admin/services/VariantPicker";
import { Button, Card, Checkbox, Field, Input, Select, Textarea, inputClass } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { t } from "@/i18n";
import { slugify } from "@/lib/slug";
import {
  BADGES,
  BADGE_LABELS,
  PRODUCT_KINDS,
  RELATION_TYPES,
  productInputSchema,
  type ProductInput,
  type VariantInput,
} from "@/lib/validation/product";
import { saveProduct, searchProducts } from "@/server/actions/products";

type CollectionOption = { id: string; name: string; kind: "CATEGORY" | "CONCERN"; depth: number };
type RelationType = (typeof RELATION_TYPES)[number];

type Props = {
  initial: ProductInput;
  collections: CollectionOption[];
  /** Read-only stock per existing variant */
  stockByVariant?: Record<string, number>;
  /** id → display name for related products and bundle variants */
  labels?: Record<string, string>;
};

const F = t.admin.productForm;
const TABS = ["main", "content", "relations", "bundle", "seo"] as const;
type Tab = (typeof TABS)[number];

/** Which tab a field error belongs to */
const TAB_OF: Record<string, Tab> = {
  tagline: "content", recommendedFor: "content", benefits: "content", description: "content", skinScience: "content",
  howToUse: "content", ingredients: "content", environmental: "content", clinicalNotes: "content",
  relations: "relations", bundleItems: "bundle", seoTitle: "seo", seoDescription: "seo",
};

const emptyVariant = (): VariantInput => ({ sku: "", barcode: null, size: "", price: 0, costPrice: 0, lowStockAt: 3, isActive: true });
const num = (v: string) => (v === "" ? Number.NaN : Number(v));
const numValue = (v: number) => (Number.isNaN(v) ? "" : v);

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Tag input with dictionary suggestions (datalist) */
function BenefitsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || value.includes(v) || value.length >= 6) return;
    onChange([...value, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {value.map((b) => (
          <span key={b} className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink/[0.04] py-1 pl-3 pr-1.5 text-[13px]">
            {b}
            <button type="button" aria-label={F.removeBenefit(b)} onClick={() => onChange(value.filter((x) => x !== b))} className="rounded-full p-0.5 hover:bg-ink/[0.08]">
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        list={listId}
        value={draft}
        disabled={value.length >= 6}
        placeholder={F.benefitsPlaceholder}
        aria-label={F.benefits}
        className={`${inputClass} w-full`}
        onChange={(e) => {
          const v = e.target.value;
          // Picking a datalist suggestion adds it immediately
          if ((t.benefitTerms as readonly string[]).includes(v)) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          }
        }}
      />
      <datalist id={listId}>
        {t.benefitTerms.filter((b) => !value.includes(b)).map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </div>
  );
}

function LinesTextarea({ id, value, onChange, rows = 4 }: { id: string; value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  return <Textarea id={id} rows={rows} value={value.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} />;
}

function OrderedList({ items, onChange, render }: { items: string[]; onChange: (v: string[]) => void; render: (id: string, i: number) => ReactNode }) {
  if (items.length === 0) return null;
  return (
    <ol className="mt-3 divide-y divide-hairline rounded-xl border border-hairline">
      {items.map((id, i) => (
        <li key={id} className="flex items-center gap-2 px-3 py-2 text-[14px]">
          <span className="w-5 text-[13px] text-ink-faint">{i + 1}.</span>
          <span className="flex-1">{render(id, i)}</span>
          <button type="button" aria-label={F.moveUp} disabled={i === 0} onClick={() => onChange(move(items, i, i - 1))} className="rounded p-1 hover:bg-ink/[0.05] disabled:opacity-30">
            <ArrowUp className="size-4" />
          </button>
          <button type="button" aria-label={F.moveDown} disabled={i === items.length - 1} onClick={() => onChange(move(items, i, i + 1))} className="rounded p-1 hover:bg-ink/[0.05] disabled:opacity-30">
            <ArrowDown className="size-4" />
          </button>
          <button type="button" aria-label={t.admin.remove} onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded p-1 text-ink-soft hover:bg-err-bg hover:text-danger">
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ol>
  );
}

export function ProductForm({ initial, collections, stockByVariant = {}, labels: initialLabels = {} }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ProductInput>(initial);
  const [labels, setLabels] = useState(initialLabels);
  const [tab, setTab] = useState<Tab>("main");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const { run, pending, fieldErrors, setFieldErrors } = useServerAction(saveProduct);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setVariant = (i: number, patch: Partial<VariantInput>) =>
    set("variants", form.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const err = (path: string) => fieldErrors[path];
  const tabHasError = (tb: Tab) =>
    Object.keys(fieldErrors).some((k) => (TAB_OF[k.split(".")[0]!] ?? "main") === tb);

  const toggleCollection = (id: string, checked: boolean) =>
    set("collectionIds", checked ? [...form.collectionIds, id] : form.collectionIds.filter((c) => c !== id));

  const relationsOf = (type: RelationType) => form.relations.filter((r) => r.type === type).map((r) => r.relatedId);
  const setRelationsOf = (type: RelationType, ids: string[]) =>
    set("relations", [
      ...form.relations.filter((r) => r.type !== type),
      ...ids.map((relatedId) => ({ relatedId, type })),
    ]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = productInputSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) (errors[issue.path.join(".") || "_"] ??= []).push(issue.message);
      setFieldErrors(errors);
      const first = Object.keys(errors)[0]?.split(".")[0];
      if (first) setTab(TAB_OF[first] ?? "main");
      toast.error(t.admin.fixFormErrors);
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
  const isBundle = form.kind === "BUNDLE";

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]" noValidate>
      <div className="min-w-0 space-y-5">
        <div role="tablist" aria-label={F.basics} className="flex flex-wrap gap-1 border-b border-hairline">
          {TABS.map((tb) => (
            <button
              key={tb}
              type="button"
              role="tab"
              aria-selected={tab === tb}
              onClick={() => setTab(tb)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[14px] ${tab === tb ? "border-navy font-medium" : "border-transparent text-ink-soft hover:text-navy"}`}
            >
              {F.tabs[tb]}
              {tabHasError(tb) && <span aria-hidden className="size-1.5 rounded-full bg-red-500" />}
            </button>
          ))}
        </div>

        {/* Main */}
        <div hidden={tab !== "main"} className="space-y-5">
          <Card title={F.basics}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t.admin.name} htmlFor="name" error={err("name")}>
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
              <Field label={t.admin.slug} htmlFor="slug" error={err("slug")} hint={`/products/${form.slug || "…"}`}>
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
              <Field label={F.kind} htmlFor="kind">
                <Select id="kind" value={form.kind} onChange={(e) => set("kind", e.target.value as ProductInput["kind"])}>
                  {PRODUCT_KINDS.map((k) => (
                    <option key={k} value={k}>{F.kinds[k]}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title={F.images}>
            <GalleryUploader value={form.images} onChange={(v) => set("images", v)} folder="products" defaultAlt={form.name} />
            {err("images") && <p className="mt-2 text-[13px] text-danger">{err("images")![0]}</p>}
          </Card>

          <Card
            title={F.variants}
            description={F.variantsHint}
            actions={
              <Button variant="secondary" size="sm" onClick={() => set("variants", [...form.variants, emptyVariant()])}>
                <Plus className="size-4" /> {t.admin.addRow}
              </Button>
            }
          >
            {err("variants") && <p className="mb-3 text-[13px] text-danger">{err("variants")![0]}</p>}
            <div className="-mx-5 -mb-5 overflow-x-auto">
              <table className="w-full min-w-[1060px] text-[13px]">
                <thead>
                  <tr className="text-left text-[13px] uppercase tracking-[0.4px] text-ink-soft">
                    <th className="px-3 py-2 pl-5 font-medium">{F.sku}</th>
                    <th className="px-2 py-2 font-medium">{F.barcode}</th>
                    <th className="px-2 py-2 font-medium">{F.size}</th>
                    <th className="px-2 py-2 font-medium">{F.price}</th>
                    <th className="px-2 py-2 font-medium">{F.cost}</th>
                    <th className="px-2 py-2 font-medium">{F.lowStockAt}</th>
                    <th className="px-2 py-2 font-medium">{F.stock}</th>
                    <th className="px-2 py-2 font-medium">{t.admin.active}</th>
                    <th className="px-2 py-2 pr-5"><span className="sr-only">{F.actions}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {form.variants.map((v, i) => {
                    const cell = (key: keyof VariantInput) => err(`variants.${i}.${key}`);
                    const cls = (key: keyof VariantInput) => `${inputClass} h-10 ${cell(key) ? "border-danger" : ""}`;
                    return (
                      <tr key={v.id ?? `new-${i}`} className={`border-t border-hairline align-top ${v.isActive ? "" : "bg-ink/[0.04] text-ink-soft"}`}>
                        <td className="px-3 py-2 pl-5">
                          <input aria-label={F.sku} value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })} className={`${cls("sku")} w-52 font-mono text-[13px]`} />
                          {cell("sku") && <p className="mt-1 text-[13px] text-danger">{cell("sku")![0]}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            aria-label={F.barcode}
                            inputMode="numeric"
                            value={v.barcode ?? ""}
                            onChange={(e) => setVariant(i, { barcode: e.target.value })}
                            // A scanner sends Enter after the code — don't submit the whole form
                            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                            placeholder={F.barcodePlaceholder}
                            className={`${cls("barcode")} w-40 font-mono text-[13px]`}
                          />
                          {cell("barcode") && <p className="mt-1 text-[13px] text-danger">{cell("barcode")![0]}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <input aria-label={F.size} value={v.size} onChange={(e) => setVariant(i, { size: e.target.value })} placeholder={F.sizePlaceholder} className={`${cls("size")} w-24`} />
                        </td>
                        <td className="px-2 py-2">
                          <MoneyInput aria-label={F.price} value={v.price} onChange={(price) => setVariant(i, { price })} invalid={Boolean(cell("price"))} className="h-8 w-36" />
                        </td>
                        <td className="px-2 py-2">
                          <MoneyInput aria-label={F.cost} value={v.costPrice} onChange={(costPrice) => setVariant(i, { costPrice })} invalid={Boolean(cell("costPrice"))} className="h-8 w-36" />
                        </td>
                        <td className="px-2 py-2">
                          <input aria-label={F.lowStockAt} type="number" min={0} value={numValue(v.lowStockAt)} onChange={(e) => setVariant(i, { lowStockAt: num(e.target.value) })} className={`${cls("lowStockAt")} w-20 text-right`} />
                        </td>
                        <td className="px-2 py-2 pt-3.5 tabular-nums text-ink-soft">{v.id ? (stockByVariant[v.id] ?? 0) : "—"}</td>
                        <td className="px-2 py-2 pt-3">
                          <input type="checkbox" aria-label={t.admin.active} checked={v.isActive} onChange={(e) => setVariant(i, { isActive: e.target.checked })} className="size-4 accent-navy" />
                        </td>
                        <td className="px-2 py-2 pr-5 text-right">
                          {!v.id && (
                            <button type="button" onClick={() => set("variants", form.variants.filter((_, j) => j !== i))} aria-label={t.admin.removeRow} className="rounded p-1.5 text-ink-soft hover:bg-err-bg hover:text-danger">
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

        {/* Content */}
        <div hidden={tab !== "content"}>
          <Card title={F.tabs.content}>
            <div className="grid gap-4">
              <Field label={F.tagline} htmlFor="tagline" error={err("tagline")} hint={F.taglineHint}>
                <Input id="tagline" value={form.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} />
              </Field>
              <Field label={F.recommendedFor} htmlFor="recommendedFor" error={err("recommendedFor")} hint={F.recommendedForHint}>
                <Input id="recommendedFor" value={form.recommendedFor ?? ""} onChange={(e) => set("recommendedFor", e.target.value)} />
              </Field>
              <Field label={F.benefits} error={err("benefits")} hint={F.benefitsHint}>
                <BenefitsInput value={form.benefits} onChange={(v) => set("benefits", v)} />
              </Field>
              <Field label={F.description} htmlFor="description" error={err("description")}>
                <Textarea id="description" rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} aria-invalid={Boolean(err("description"))} />
              </Field>
              <Field label={F.skinScience} htmlFor="skinScience" error={err("skinScience")} hint={t.admin.optional}>
                <Textarea id="skinScience" rows={3} value={form.skinScience ?? ""} onChange={(e) => set("skinScience", e.target.value)} />
              </Field>
              <Field label={F.howToUse} htmlFor="howToUse" error={err("howToUse")} hint={F.howToUseHint}>
                <LinesTextarea id="howToUse" value={form.howToUse} onChange={(v) => set("howToUse", v)} />
              </Field>
              <Field label={F.ingredients} htmlFor="ingredients" error={err("ingredients")} hint={F.ingredientsHint}>
                <Textarea id="ingredients" rows={3} lang="la" value={form.ingredients ?? ""} onChange={(e) => set("ingredients", e.target.value)} />
              </Field>
              <Field label={F.environmental} error={err("environmental")}>
                <div className="space-y-2">
                  {form.environmental.map((row, i) => (
                    <div key={i} className="flex gap-2">
                      <Input aria-label={F.envKey} placeholder={F.envKey} value={row.key} onChange={(e) => set("environmental", form.environmental.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))} className="w-48" />
                      <Input aria-label={F.envValue} placeholder={F.envValue} value={row.value} onChange={(e) => set("environmental", form.environmental.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} />
                      <Button variant="ghost" size="sm" className="h-9" aria-label={t.admin.removeRow} onClick={() => set("environmental", form.environmental.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => set("environmental", [...form.environmental, { key: "", value: "" }])}>
                    <Plus className="size-4" /> {t.admin.addRow}
                  </Button>
                </div>
              </Field>
              <Field label={F.clinicalNotes} htmlFor="clinicalNotes" error={err("clinicalNotes")} hint={F.clinicalNotesHint}>
                <LinesTextarea id="clinicalNotes" rows={3} value={form.clinicalNotes} onChange={(v) => set("clinicalNotes", v)} />
              </Field>
            </div>
          </Card>
        </div>

        {/* Relations */}
        <div hidden={tab !== "relations"} className="space-y-5">
          {RELATION_TYPES.map((type) => {
            const ids = relationsOf(type);
            return (
              <Card key={type} title={F.relations[type]} description={F.relationsHint}>
                <SearchPicker
                  search={searchProducts}
                  exclude={[...ids, ...(form.id ? [form.id] : [])]}
                  label={t.admin.productSearch.label}
                  placeholder={t.admin.productSearch.placeholder}
                  onSelect={(o) => {
                    setLabels((l) => ({ ...l, [o.id]: o.label }));
                    setRelationsOf(type, [...ids, o.id]);
                  }}
                />
                <OrderedList items={ids} onChange={(v) => setRelationsOf(type, v)} render={(id) => labels[id] ?? id} />
              </Card>
            );
          })}
          {err("relations") && <p className="text-[13px] text-danger">{err("relations")![0]}</p>}
        </div>

        {/* Bundle */}
        <div hidden={tab !== "bundle"}>
          <Card title={F.bundleItems} description={F.bundleHint}>
            {!isBundle ? (
              <p className="text-[14px] text-ink-soft">{F.bundleOnlyForBundle}</p>
            ) : (
              <>
                <VariantPicker
                  exclude={form.bundleItems.map((b) => b.variantId)}
                  onSelect={(o) => {
                    setLabels((l) => ({ ...l, [o.id]: `${o.label} (${o.sku})` }));
                    set("bundleItems", [...form.bundleItems, { variantId: o.id, qty: 1 }]);
                  }}
                />
                {form.bundleItems.length > 0 && (
                  <ol className="mt-3 divide-y divide-hairline rounded-xl border border-hairline">
                    {form.bundleItems.map((b, i) => (
                      <li key={b.variantId} className="flex items-center gap-2 px-3 py-2 text-[14px]">
                        <span className="w-5 text-[13px] text-ink-faint">{i + 1}.</span>
                        <span className="flex-1">{labels[b.variantId] ?? b.variantId}</span>
                        <input
                          type="number"
                          min={1}
                          aria-label={F.qty}
                          value={numValue(b.qty)}
                          onChange={(e) => set("bundleItems", form.bundleItems.map((x, j) => (j === i ? { ...x, qty: num(e.target.value) } : x)))}
                          className={`${inputClass} h-10 w-16 text-right`}
                        />
                        <button type="button" aria-label={F.moveUp} disabled={i === 0} onClick={() => set("bundleItems", move(form.bundleItems, i, i - 1))} className="rounded p-1 hover:bg-ink/[0.05] disabled:opacity-30">
                          <ArrowUp className="size-4" />
                        </button>
                        <button type="button" aria-label={F.moveDown} disabled={i === form.bundleItems.length - 1} onClick={() => set("bundleItems", move(form.bundleItems, i, i + 1))} className="rounded p-1 hover:bg-ink/[0.05] disabled:opacity-30">
                          <ArrowDown className="size-4" />
                        </button>
                        <button type="button" aria-label={t.admin.remove} onClick={() => set("bundleItems", form.bundleItems.filter((_, j) => j !== i))} className="rounded p-1 text-ink-soft hover:bg-err-bg hover:text-danger">
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
            {err("bundleItems") && <p className="mt-2 text-[13px] text-danger">{err("bundleItems")![0]}</p>}
          </Card>
        </div>

        {/* SEO */}
        <div hidden={tab !== "seo"}>
          <Card title={F.tabs.seo}>
            <div className="grid gap-4">
              <Field label={F.seoTitle} htmlFor="seoTitle" error={err("seoTitle")} hint={F.seoTitleHint}>
                <Input id="seoTitle" value={form.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value)} />
              </Field>
              <Field label={F.seoDescription} htmlFor="seoDescription" error={err("seoDescription")}>
                <Textarea id="seoDescription" rows={3} value={form.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-5">
        <Card title={t.admin.status}>
          <div className="space-y-4">
            <Checkbox label={F.publish} checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
            <p className="-mt-2 text-[13px] text-ink-soft">{F.publishHint}</p>
            <Field label={F.badge} htmlFor="badge">
              <Select id="badge" value={form.badge ?? ""} onChange={(e) => set("badge", (e.target.value || null) as ProductInput["badge"])}>
                <option value="">{F.noBadge}</option>
                {BADGES.map((b) => (
                  <option key={b} value={b}>{BADGE_LABELS[b]}</option>
                ))}
              </Select>
            </Field>
            <Field label={t.admin.sortOrder} htmlFor="sortOrder" error={err("sortOrder")} hint={t.admin.sortOrderHint}>
              <Input id="sortOrder" type="number" min={0} value={numValue(form.sortOrder)} onChange={(e) => set("sortOrder", num(e.target.value))} />
            </Field>
          </div>
        </Card>

        <Card title={F.categories}>
          <div className="flex flex-col gap-2">
            {categories.map((c) => (
              <Checkbox
                key={c.id}
                label={c.name}
                checked={form.collectionIds.includes(c.id)}
                onChange={(e) => toggleCollection(c.id, e.target.checked)}
                className={c.depth === 1 ? "pl-5" : c.depth >= 2 ? "pl-10" : ""}
              />
            ))}
          </div>
        </Card>

        <Card title={F.concerns}>
          <div className="flex flex-col gap-2">
            {concerns.map((c) => (
              <Checkbox key={c.id} label={c.name} checked={form.collectionIds.includes(c.id)} onChange={(e) => toggleCollection(c.id, e.target.checked)} />
            ))}
          </div>
        </Card>

        <div className="sticky bottom-4 flex gap-2 rounded-2xl border border-hairline bg-white p-3 shadow-sm">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? t.admin.saving : t.admin.save}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/admin/products")}>
            {t.admin.back}
          </Button>
        </div>
      </div>
    </form>
  );
}
