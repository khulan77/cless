"use client";

import NextLink from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SingleImageUploader } from "@/components/admin/ImageUploader";
import { Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/admin/ui";
import { defaultImage } from "@/lib/default-images";
import { useServerAction } from "@/components/admin/use-action";
import type { Image, Link, SiteSettings } from "@/lib/site-settings";
import { BENEFIT_ICONS, settingSchemas, type EditableSettingKey } from "@/lib/validation/site-settings";
import { saveSetting } from "@/server/actions/settings";
import { t } from "@/i18n";

type Errors = Record<string, string[]>;

/** Shared: state + client validation + save */
function useSettingForm<K extends EditableSettingKey>(key: K, initial: SiteSettings[K]) {
  const router = useRouter();
  const [value, setValue] = useState<SiteSettings[K]>(initial);
  const action = useServerAction(saveSetting);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = settingSchemas[key].safeParse(value);
    if (!parsed.success) {
      const errors: Errors = {};
      for (const i of parsed.error.issues) (errors[i.path.join(".") || "_"] ??= []).push(i.message);
      action.setFieldErrors(errors);
      toast.error(t.admin.fixFormErrors);
      return;
    }
    await action.run({ key, value }, { onSuccess: () => router.refresh() });
  };
  return { value, setValue, submit, pending: action.pending, err: (p: string) => action.fieldErrors[p] };
}

function Shell({ title, description, onSubmit, pending, children }: {
  title: string; description?: string; onSubmit: (e: React.FormEvent) => void; pending: boolean; children: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card title={title} description={description}>
        <div className="space-y-5">{children}</div>
        <div className="mt-6 flex justify-end border-t border-hairline pt-4">
          <Button type="submit" disabled={pending}>{pending ? t.admin.saving : t.admin.save}</Button>
        </div>
      </Card>
    </form>
  );
}

/** Image + alt. With a default slot: "Үндсэн зураг" badge, "Үндсэн рүү буцаах"; hero: low-resolution warning */
function ImageField({ value, onChange, prefix, err, slot, minWidth }: {
  value: Image;
  onChange: (v: Image) => void;
  prefix: string;
  err: (p: string) => string[] | undefined;
  /** Default image slot (lib/default-images) */
  slot?: string;
  /** Warn when the uploaded image is narrower than this (px) */
  minWidth?: number;
}) {
  const C = t.admin.content;
  const def = slot ? defaultImage(slot) : null;
  const isDefault = Boolean(def && value.src === def);
  const width = useNaturalWidth(value.src);
  return (
    <div className="grid gap-3 md:grid-cols-[auto_1fr]">
      <div className="space-y-2">
        <SingleImageUploader value={value.src || null} onChange={(src) => onChange({ ...value, src: src ?? "" })} folder="content" />
        {isDefault && <Badge tone="champagne">{C.defaultBadge}</Badge>}
        {def && !isDefault && (
          <button type="button" onClick={() => onChange({ ...value, src: def })} className="block text-[13px] text-ink-soft underline underline-offset-4 hover:text-ink">
            {C.resetDefault}
          </button>
        )}
        {minWidth && width !== null && width < minWidth && <p className="max-w-56 text-[13px] text-warn">{C.lowRes(width, minWidth)}</p>}
        {err(`${prefix}.src`) && <p className="mt-1 text-[13px] text-danger">{err(`${prefix}.src`)![0]}</p>}
      </div>
      <Field label={C.imageAlt} htmlFor={`${prefix}-alt`} hint={C.imageAltHint}>
        <Input id={`${prefix}-alt`} value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
      </Field>
    </div>
  );
}

/** Natural width of an image URL (null until loaded / for SVG placeholders) */
function useNaturalWidth(src: string) {
  const [w, setW] = useState<{ src: string; width: number } | null>(null);
  useEffect(() => {
    if (!src || src.endsWith(".svg")) return;
    const img = new window.Image();
    img.onload = () => setW({ src, width: img.naturalWidth });
    img.src = src;
  }, [src]);
  return w && w.src === src ? w.width : null;
}

function LinkField({ value, onChange, prefix, err }: { value: Link; onChange: (v: Link) => void; prefix: string; err: (p: string) => string[] | undefined }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label={t.admin.content.ctaLabel} htmlFor={`${prefix}-label`} error={err(`${prefix}.label`)}>
        <Input id={`${prefix}-label`} value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
      </Field>
      <Field label={t.admin.content.ctaHref} htmlFor={`${prefix}-href`} error={err(`${prefix}.href`)} hint={t.admin.content.ctaHrefHint}>
        <Input id={`${prefix}-href`} value={value.href} onChange={(e) => onChange({ ...value, href: e.target.value })} />
      </Field>
    </div>
  );
}

/* ─────────────── Announcement ─────────────── */
export function AnnouncementForm({ initial }: { initial: SiteSettings["announcement"] }) {
  const { value, setValue, submit, pending, err } = useSettingForm("announcement", initial);
  const setMsg = (i: number, m: string) => setValue({ ...value, messages: value.messages.map((x, j) => (j === i ? m : x)) });
  return (
    <Shell title={t.admin.content.announcement} description={t.admin.content.announcementHint} onSubmit={submit} pending={pending}>
      <div className="space-y-2">
        {value.messages.map((m, i) => (
          <div key={i} className="flex gap-2">
            <Input aria-label={t.admin.content.line(i + 1)} value={m} onChange={(e) => setMsg(i, e.target.value)} aria-invalid={Boolean(err(`messages.${i}`))} />
            <Button variant="ghost" size="sm" className="h-9" aria-label={t.admin.removeRow} disabled={value.messages.length <= 1} onClick={() => setValue({ ...value, messages: value.messages.filter((_, j) => j !== i) })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {err("messages") && <p className="text-[13px] text-danger">{err("messages")![0]}</p>}
        {value.messages.length < 6 && (
          <Button variant="secondary" size="sm" onClick={() => setValue({ ...value, messages: [...value.messages, ""] })}>
            <Plus className="size-4" /> {t.admin.addRow}
          </Button>
        )}
      </div>
      <Field label={t.admin.content.interval} htmlFor="interval" error={err("intervalMs")}>
        <Input id="interval" type="number" min={2} max={30} className="w-32" value={value.intervalMs / 1000} onChange={(e) => setValue({ ...value, intervalMs: Math.round(Number(e.target.value) * 1000) })} />
      </Field>
    </Shell>
  );
}

/* ─────────────── Hero ─────────────── */
export function HeroForm({ initial }: { initial: SiteSettings["hero"] }) {
  const { value, setValue, submit, pending, err } = useSettingForm("hero", initial);
  return (
    <Shell title={t.admin.content.hero} description={t.admin.content.heroHint} onSubmit={submit} pending={pending}>
      <ImageField value={value.image} onChange={(image) => setValue({ ...value, image })} prefix="image" err={err} slot="hero" minWidth={1920} />
      <FocalPicker src={value.image.src} focal={value.focal ?? { x: 50, y: 50 }} onChange={(focal) => setValue({ ...value, focal })} />
      <fieldset className="space-y-3 rounded-xl border border-hairline p-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={value.layout === "center"} onChange={(e) => setValue({ ...value, layout: e.target.checked ? "center" : "cover" })} className="mt-1 accent-navy" />
          <span>
            <span className="block text-[14px] font-medium">{t.admin.content.layoutCenter}</span>
            <span className="block text-[13px] text-ink-soft">{t.admin.content.layoutCenterHint}</span>
          </span>
        </label>
        {value.layout === "center" && (
          <label className="flex items-center gap-3 pl-7 text-[14px]">
            <input type="color" value={value.background ?? "#ffffff"} onChange={(e) => setValue({ ...value, background: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-hairline" />
            <span>{t.admin.content.background}</span>
            <span className="text-ink-soft tabular-nums">{value.background ?? "#ffffff"}</span>
          </label>
        )}
        <label className="flex items-center gap-3 text-[14px]">
          <input type="checkbox" checked={value.headerTone === "dark"} onChange={(e) => setValue({ ...value, headerTone: e.target.checked ? "dark" : "light" })} className="accent-navy" />
          <span>{t.admin.content.headerDark}</span>
        </label>
      </fieldset>
      <fieldset className="space-y-2 rounded-xl border border-hairline p-4">
        <legend className="px-1 text-[14px] font-medium">{t.admin.content.mobileImage}</legend>
        <p className="text-[13px] text-ink-soft">{t.admin.content.mobileImageHint}</p>
        <ImageField
          value={value.mobileImage ?? { src: "", alt: value.image.alt }}
          onChange={(mobileImage) => setValue({ ...value, mobileImage: mobileImage.src ? mobileImage : null })}
          prefix="mobileImage"
          err={err}
          minWidth={1080}
        />
      </fieldset>
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Field key={i} label={t.admin.content.heroLine(i + 1)} htmlFor={`hero-t${i}`} error={err(`title.${i}`)}>
            <Input
              id={`hero-t${i}`}
              value={value.title[i] ?? ""}
              onChange={(e) => {
                // empty second line → single-line title
                const t = [value.title[0] ?? "", value.title[1] ?? ""];
                t[i] = e.target.value;
                setValue({ ...value, title: t[1] ? t : [t[0]!] });
              }}
            />
          </Field>
        ))}
      </div>
      <LinkField value={value.cta} onChange={(cta) => setValue({ ...value, cta })} prefix="cta" err={err} />
    </Shell>
  );
}

/** Click the preview (or use the sliders) to set what stays in frame when the hero is cropped */
function FocalPicker({ src, focal, onChange }: { src: string; focal: { x: number; y: number }; onChange: (f: { x: number; y: number }) => void }) {
  const C = t.admin.content;
  if (!src) return null;
  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <button
        type="button"
        aria-label={C.focal}
        className="relative aspect-video overflow-hidden rounded-xl bg-canvas"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onChange({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) });
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of the uploaded original */}
        <img src={src} alt="" className="size-full object-cover" style={{ objectPosition: `${focal.x}% ${focal.y}%` }} />
        <span aria-hidden className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${focal.x}%`, top: `${focal.y}%` }} />
      </button>
      <div className="space-y-3">
        <p className="text-[14px] font-medium">{C.focal}</p>
        <p className="text-[13px] text-ink-soft">{C.focalHint}</p>
        {(["x", "y"] as const).map((k) => (
          <label key={k} className="flex items-center gap-3 text-[14px]">
            <span className="w-28 text-ink-soft">{k === "x" ? C.focalX : C.focalY}</span>
            <input type="range" min={0} max={100} value={focal[k]} onChange={(e) => onChange({ ...focal, [k]: Number(e.target.value) })} className="flex-1 accent-navy" />
            <span className="w-10 text-right tabular-nums">{focal[k]}%</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── Promo trio ─────────────── */
export function PromoTrioForm({ initial }: { initial: SiteSettings["promoTrio"] }) {
  const { value, setValue, submit, pending, err } = useSettingForm("promoTrio", initial);
  const setItem = (i: number, patch: Partial<SiteSettings["promoTrio"]["items"][number]>) =>
    setValue({ items: value.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <Shell title={t.admin.content.promoTrio} onSubmit={submit} pending={pending}>
      {value.items.map((it, i) => (
        <fieldset key={i} className="space-y-3 rounded-xl border border-hairline p-4">
          <legend className="px-1 text-[13px] font-medium">{t.admin.content.card(i + 1)}</legend>
          <ImageField value={it.image} onChange={(image) => setItem(i, { image })} prefix={`items.${i}.image`} err={err} slot={`promo.${i}`} />
          <Field label={t.admin.title} htmlFor={`p${i}-title`} error={err(`items.${i}.title`)}>
            <Input id={`p${i}-title`} value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
          </Field>
          <Field label={t.admin.description} htmlFor={`p${i}-text`} error={err(`items.${i}.text`)}>
            <Textarea id={`p${i}-text`} rows={2} value={it.text} onChange={(e) => setItem(i, { text: e.target.value })} />
          </Field>
          <LinkField value={it.cta} onChange={(cta) => setItem(i, { cta })} prefix={`items.${i}.cta`} err={err} />
        </fieldset>
      ))}
    </Shell>
  );
}

/* ─────────────── Split promo ─────────────── */
export function SplitPromoForm({ initial }: { initial: SiteSettings["splitPromo"] }) {
  const { value, setValue, submit, pending, err } = useSettingForm("splitPromo", initial);
  return (
    <Shell title={t.admin.content.splitPromo} onSubmit={submit} pending={pending}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t.admin.content.eyebrow} htmlFor="sp-eyebrow" error={err("eyebrow")}>
          <Input id="sp-eyebrow" value={value.eyebrow} onChange={(e) => setValue({ ...value, eyebrow: e.target.value })} />
        </Field>
        <Field label={t.admin.title} htmlFor="sp-title" error={err("title")}>
          <Input id="sp-title" value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} />
        </Field>
      </div>
      <Field label={t.admin.text} htmlFor="sp-text" error={err("text")}>
        <Textarea id="sp-text" rows={3} value={value.text} onChange={(e) => setValue({ ...value, text: e.target.value })} />
      </Field>
      <LinkField value={value.cta} onChange={(cta) => setValue({ ...value, cta })} prefix="cta" err={err} />
      <ImageField value={value.image} onChange={(image) => setValue({ ...value, image })} prefix="image" err={err} slot="split" />
    </Shell>
  );
}

/* ─────────────── Featured product ─────────────── */
export function FeaturedProductForm({ initial, products }: { initial: SiteSettings["featuredProduct"]; products: { slug: string; name: string }[] }) {
  const { value, setValue, submit, pending, err } = useSettingForm("featuredProduct", initial);
  return (
    <Shell title={t.admin.content.featured} onSubmit={submit} pending={pending}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t.admin.title} htmlFor="fp-title" error={err("title")}>
          <Input id="fp-title" value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} />
        </Field>
        <Field label={t.admin.product} htmlFor="fp-product" error={err("productSlug")} hint={t.admin.content.featuredHint}>
          <Select id="fp-product" value={value.productSlug} onChange={(e) => setValue({ ...value, productSlug: e.target.value })}>
            {!products.some((p) => p.slug === value.productSlug) && <option value={value.productSlug}>{t.admin.content.choose}</option>}
            {products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </Select>
        </Field>
      </div>
      <ImageField value={value.image} onChange={(image) => setValue({ ...value, image })} prefix="image" err={err} slot="featured" />
    </Shell>
  );
}

/* ─────────────── Benefits ─────────────── */
export function BenefitsForm({ initial }: { initial: SiteSettings["benefits"] }) {
  const { value, setValue, submit, pending, err } = useSettingForm("benefits", initial);
  type Item = SiteSettings["benefits"]["items"][number];
  const setItem = (i: number, patch: Partial<Item>) => setValue({ items: value.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <Shell title={t.admin.content.benefits} description={t.admin.content.benefitsHint} onSubmit={submit} pending={pending}>
      {value.items.map((it, i) => (
        <div key={i} className="grid gap-3 md:grid-cols-[160px_1fr_1fr]">
          <Field label={t.admin.content.icon} htmlFor={`b${i}-icon`}>
            <Select id={`b${i}-icon`} value={it.icon} onChange={(e) => setItem(i, { icon: e.target.value as Item["icon"] })}>
              {Object.entries(BENEFIT_ICONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label={t.admin.content.line(1)} htmlFor={`b${i}-l1`} error={err(`items.${i}.lines.0`)}>
            <Input id={`b${i}-l1`} value={it.lines[0]} onChange={(e) => setItem(i, { lines: [e.target.value, it.lines[1]] })} />
          </Field>
          <Field label={t.admin.content.line(2)} htmlFor={`b${i}-l2`} error={err(`items.${i}.lines.1`)}>
            <Input id={`b${i}-l2`} value={it.lines[1]} onChange={(e) => setItem(i, { lines: [it.lines[0], e.target.value] })} />
          </Field>
        </div>
      ))}
    </Shell>
  );
}

/* ─────────────── Product page benefits ─────────────── */
export function ProductBenefitsForm({ initial }: { initial: SiteSettings["productBenefits"] }) {
  const { value, setValue, submit, pending, err } = useSettingForm("productBenefits", initial);
  type Item = SiteSettings["productBenefits"]["items"][number];
  const setItem = (i: number, patch: Partial<Item>) => setValue({ items: value.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <Shell title={t.admin.content.productBenefits} description={t.admin.content.productBenefitsHint} onSubmit={submit} pending={pending}>
      {value.items.map((it, i) => (
        <div key={i} className="grid items-end gap-3 md:grid-cols-[160px_1fr_auto]">
          <Field label={t.admin.content.icon} htmlFor={`pb${i}-icon`}>
            <Select id={`pb${i}-icon`} value={it.icon} onChange={(e) => setItem(i, { icon: e.target.value as Item["icon"] })}>
              {Object.entries(BENEFIT_ICONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label={t.admin.content.line(i + 1)} htmlFor={`pb${i}-label`} error={err(`items.${i}.label`)}>
            <Input id={`pb${i}-label`} value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} />
          </Field>
          <Button variant="ghost" size="sm" className="h-9" aria-label={t.admin.removeRow} disabled={value.items.length <= 1} onClick={() => setValue({ items: value.items.filter((_, j) => j !== i) })}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      {value.items.length < 4 && (
        <Button variant="secondary" size="sm" onClick={() => setValue({ items: [...value.items, { icon: "gift", label: "" }] })}>
          <Plus className="size-4" /> {t.admin.addRow}
        </Button>
      )}
    </Shell>
  );
}

/* ─────────────── Footer bottom line ─────────────── */

/**
 * Only the copyright line lives here. Contact details, socials and hours have a single source:
 * Settings → Salon info and the branch hours (staff schedules). The rest passes through untouched.
 */
export function ContactFooterForm({ initial }: { initial: SiteSettings["footer"] }) {
  const { value, setValue, submit, pending, err } = useSettingForm("footer", initial);
  const C = t.admin.content;
  return (
    <Shell title={C.contactFooter} description={C.contactFooterHint} onSubmit={submit} pending={pending}>
      <p className="text-[13px] text-ink-soft">
        {C.contactMoved}{" "}
        <NextLink href="/admin/settings/salon" className="underline">
          {C.contactMovedLink}
        </NextLink>
      </p>
      <Field label={C.copyright} htmlFor="cf-copyright" error={err("copyright")} hint={C.copyrightHint}>
        <Input id="cf-copyright" value={value.copyright} onChange={(e) => setValue({ ...value, copyright: e.target.value })} />
      </Field>
    </Shell>
  );
}
