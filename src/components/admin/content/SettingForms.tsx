"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SingleImageUploader } from "@/components/admin/ImageUploader";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/admin/ui";
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
        <div className="mt-6 flex justify-end border-t border-line pt-4">
          <Button type="submit" disabled={pending}>{pending ? t.admin.saving : t.admin.save}</Button>
        </div>
      </Card>
    </form>
  );
}

function ImageField({ value, onChange, prefix, err }: { value: Image; onChange: (v: Image) => void; prefix: string; err: (p: string) => string[] | undefined }) {
  return (
    <div className="grid gap-3 md:grid-cols-[auto_1fr]">
      <div>
        <SingleImageUploader value={value.src || null} onChange={(src) => onChange({ ...value, src: src ?? "" })} folder="content" />
        {err(`${prefix}.src`) && <p className="mt-1 text-[12px] text-red-600">{err(`${prefix}.src`)![0]}</p>}
      </div>
      <Field label={t.admin.content.imageAlt} htmlFor={`${prefix}-alt`} hint={t.admin.content.imageAltHint}>
        <Input id={`${prefix}-alt`} value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
      </Field>
    </div>
  );
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
        {err("messages") && <p className="text-[12px] text-red-600">{err("messages")![0]}</p>}
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
      <ImageField value={value.image} onChange={(image) => setValue({ ...value, image })} prefix="image" err={err} />
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

/* ─────────────── Promo trio ─────────────── */
export function PromoTrioForm({ initial }: { initial: SiteSettings["promoTrio"] }) {
  const { value, setValue, submit, pending, err } = useSettingForm("promoTrio", initial);
  const setItem = (i: number, patch: Partial<SiteSettings["promoTrio"]["items"][number]>) =>
    setValue({ items: value.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <Shell title={t.admin.content.promoTrio} onSubmit={submit} pending={pending}>
      {value.items.map((it, i) => (
        <fieldset key={i} className="space-y-3 rounded-md border border-line p-4">
          <legend className="px-1 text-[13px] font-medium">{t.admin.content.card(i + 1)}</legend>
          <ImageField value={it.image} onChange={(image) => setItem(i, { image })} prefix={`items.${i}.image`} err={err} />
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
      <ImageField value={value.image} onChange={(image) => setValue({ ...value, image })} prefix="image" err={err} />
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
      <ImageField value={value.image} onChange={(image) => setValue({ ...value, image })} prefix="image" err={err} />
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

/* ─────────────── Contact & footer ─────────────── */
type Network = "instagram" | "facebook";
const NETWORKS: Network[] = ["instagram", "facebook"];

/** Edits contact details, social URLs and the bottom line; columns/newsletter pass through untouched */
export function ContactFooterForm({ initial }: { initial: SiteSettings["footer"] }) {
  // Make sure both networks have a row so each gets its own field
  const withNetworks: SiteSettings["footer"] = {
    ...initial,
    socials: NETWORKS.map(
      (network) =>
        initial.socials.find((s) => s.network === network) ?? {
          network,
          href: "",
          label: network === "instagram" ? "Instagram" : "Facebook",
        },
    ),
  };
  const { value, setValue, submit, pending, err } = useSettingForm("footer", withNetworks);
  const C = t.admin.content;
  const setContact = (patch: Partial<SiteSettings["footer"]["contact"]>) => setValue({ ...value, contact: { ...value.contact, ...patch } });
  const setSocial = (network: Network, href: string) =>
    setValue({ ...value, socials: value.socials.map((s) => (s.network === network ? { ...s, href } : s)) });
  const socialIndex = (network: Network) => value.socials.findIndex((s) => s.network === network);

  return (
    <Shell title={C.contactFooter} description={C.contactFooterHint} onSubmit={submit} pending={pending}>
      <Field label={C.address} htmlFor="cf-address" error={err("contact.address")}>
        <Textarea id="cf-address" rows={2} value={value.contact.address} onChange={(e) => setContact({ address: e.target.value })} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={C.phone} htmlFor="cf-phone" error={err("contact.phone")} hint={C.phoneHint}>
          <Input id="cf-phone" type="tel" inputMode="tel" value={value.contact.phone} onChange={(e) => setContact({ phone: e.target.value })} />
        </Field>
        <Field label={C.email} htmlFor="cf-email" error={err("contact.email")}>
          <Input id="cf-email" type="email" value={value.contact.email} onChange={(e) => setContact({ email: e.target.value })} />
        </Field>
      </div>
      <Field label={C.hours} htmlFor="cf-hours" error={err("contact.hours")} hint={C.hoursHint}>
        <Textarea id="cf-hours" rows={3} value={value.contact.hours.join("\n")} onChange={(e) => setContact({ hours: e.target.value.split("\n") })} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        {NETWORKS.map((network) => {
          const i = socialIndex(network);
          return (
            <Field key={network} label={C[network]} htmlFor={`cf-${network}`} error={err(`socials.${i}.href`)} hint={C.socialHint}>
              <Input
                id={`cf-${network}`}
                type="url"
                inputMode="url"
                placeholder={`https://${network}.com/…`}
                value={value.socials[i]?.href ?? ""}
                onChange={(e) => setSocial(network, e.target.value)}
              />
            </Field>
          );
        })}
      </div>
      <Field label={C.copyright} htmlFor="cf-copyright" error={err("copyright")} hint={C.copyrightHint}>
        <Input id="cf-copyright" value={value.copyright} onChange={(e) => setValue({ ...value, copyright: e.target.value })} />
      </Field>
    </Shell>
  );
}
