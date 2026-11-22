"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SingleImageUploader } from "@/components/admin/ImageUploader";
import { Button, Card, Field, Input, Textarea, btnClass } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { SafeMarkdown } from "@/components/ui/SafeMarkdown";
import type { SiteSettings } from "@/lib/site-settings";
import { settingSchemas } from "@/lib/validation/site-settings";
import { saveSetting } from "@/server/actions/settings";
import { t } from "@/i18n";
import { infra } from "@/i18n/mn.infra";

const C = infra.content;
type Key = "aboutPage" | "privacyPage" | "contactPage";

type Value<K extends Key> = NonNullable<SiteSettings[K]>;

function useForm<K extends Key>(key: K, initial: Value<K>) {
  const router = useRouter();
  const [value, setValue] = useState<Value<K>>(initial);
  const action = useServerAction(saveSetting);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = settingSchemas[key].safeParse(value);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const i of parsed.error.issues) (errors[i.path.join(".") || "_"] ??= []).push(i.message);
      action.setFieldErrors(errors);
      toast.error(t.admin.fixFormErrors);
      return;
    }
    await action.run({ key, value }, { onSuccess: () => router.refresh() });
  };
  return { value, setValue, submit, pending: action.pending, err: (p: string) => action.fieldErrors[p] };
}

function Shell({ title, description, href, onSubmit, pending, children }: {
  title: string; description?: ReactNode; href: string; onSubmit: (e: React.FormEvent) => void; pending: boolean; children: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card title={title} description={description} actions={<Link href={href} target="_blank" className={btnClass("ghost", "sm")}>{C.viewPage}</Link>}>
        <div className="space-y-5">{children}</div>
        <div className="mt-6 flex justify-end border-t border-line pt-4">
          <Button type="submit" disabled={pending} className="max-sm:h-11 max-sm:w-full">{pending ? t.admin.saving : t.admin.save}</Button>
        </div>
      </Card>
    </form>
  );
}

/* ─────────────── Бидний тухай ─────────────── */
export function AboutPageForm({ initial }: { initial: Value<"aboutPage"> }) {
  const f = useForm("aboutPage", initial);
  const v = f.value;
  const set = (patch: Partial<typeof v>) => f.setValue({ ...v, ...patch });
  const setSection = (i: number, patch: Partial<(typeof v.sections)[number]>) =>
    set({ sections: v.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <Shell title={C.about.card} description={C.about.cardHint} href="/about" onSubmit={f.submit} pending={f.pending}>
      <Field label={C.about.title} htmlFor="about-title" error={f.err("title")}>
        <Input id="about-title" value={v.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label={C.about.intro} htmlFor="about-intro" error={f.err("intro")}>
        <Textarea id="about-intro" rows={4} value={v.intro} onChange={(e) => set({ intro: e.target.value })} />
      </Field>
      {f.err("sections") && <p className="text-[12px] text-red-600" role="alert">{f.err("sections")![0]}</p>}
      {v.sections.map((s, i) => (
        <fieldset key={i} className="space-y-3 rounded-md border border-line p-4">
          <div className="flex items-center justify-between">
            <legend className="text-[13px] font-medium">{C.about.section(i + 1)}</legend>
            {v.sections.length > 2 && (
              <Button variant="ghost" size="sm" onClick={() => set({ sections: v.sections.filter((_, j) => j !== i) })} aria-label={C.about.removeSection}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </div>
          <Field label={C.about.sectionTitle} htmlFor={`about-s${i}-title`} error={f.err(`sections.${i}.title`)}>
            <Input id={`about-s${i}-title`} value={s.title} onChange={(e) => setSection(i, { title: e.target.value })} />
          </Field>
          <Field label={C.about.sectionText} htmlFor={`about-s${i}-text`} error={f.err(`sections.${i}.text`)}>
            <Textarea id={`about-s${i}-text`} rows={4} value={s.text} onChange={(e) => setSection(i, { text: e.target.value })} />
          </Field>
          <div className="grid gap-3 md:grid-cols-[auto_1fr]">
            <div>
              <SingleImageUploader value={s.image.src || null} onChange={(src) => setSection(i, { image: { ...s.image, src: src ?? "" } })} folder="content" />
              {f.err(`sections.${i}.image.src`) && <p className="mt-1 text-[12px] text-red-600">{f.err(`sections.${i}.image.src`)![0]}</p>}
            </div>
            <Field label={t.admin.content.imageAlt} htmlFor={`about-s${i}-alt`} hint={t.admin.content.imageAltHint}>
              <Input id={`about-s${i}-alt`} value={s.image.alt} onChange={(e) => setSection(i, { image: { ...s.image, alt: e.target.value } })} />
            </Field>
          </div>
        </fieldset>
      ))}
      {v.sections.length < 3 && (
        <Button variant="secondary" onClick={() => set({ sections: [...v.sections, { title: "", text: "", image: { src: "", alt: "" } }] })}>
          <Plus className="size-4" aria-hidden /> {C.about.addSection}
        </Button>
      )}
    </Shell>
  );
}

/* ─────────────── Нууцлалын бодлого ─────────────── */
export function PrivacyPageForm({ initial }: { initial: Value<"privacyPage"> }) {
  const f = useForm("privacyPage", initial);
  const v = f.value;
  const [preview, setPreview] = useState(false);
  return (
    <Shell title={C.privacy.card} description={C.privacy.cardHint} href="/privacy" onSubmit={f.submit} pending={f.pending}>
      {/* Зөвхөн админд харагдана */}
      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900" role="note">
        {C.privacy.templateNote}
      </p>
      <Field label={C.privacy.title} htmlFor="privacy-title" error={f.err("title")}>
        <Input id="privacy-title" value={v.title} onChange={(e) => f.setValue({ ...v, title: e.target.value })} />
      </Field>
      <Field label={C.privacy.body} htmlFor="privacy-body" error={f.err("body")} hint={C.privacy.bodyHint}>
        <Textarea id="privacy-body" rows={18} className="font-mono text-[13px]" value={v.body} onChange={(e) => f.setValue({ ...v, body: e.target.value })} />
      </Field>
      <div>
        <Button variant="secondary" size="sm" onClick={() => setPreview((p) => !p)} aria-expanded={preview}>
          {C.privacy.preview}
        </Button>
        {preview && (
          <div className="mt-3 rounded-md border border-line p-5">
            <SafeMarkdown source={v.body} />
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ─────────────── Холбоо барих хуудас ─────────────── */
export function ContactPageForm({ initial }: { initial: Value<"contactPage"> }) {
  const f = useForm("contactPage", initial);
  return (
    <Shell title={C.contact.card} description={C.contact.cardHint} href="/contact" onSubmit={f.submit} pending={f.pending}>
      <Link href="/admin/content?tab=footer" className="text-[13px] underline underline-offset-2">{C.contact.footerTab}</Link>
      <Field label={C.contact.map} htmlFor="contact-map" error={f.err("mapEmbedUrl")} hint={C.contact.mapHint}>
        <Textarea
          id="contact-map"
          rows={3}
          className="font-mono text-[12.5px]"
          value={f.value.mapEmbedUrl}
          onChange={(e) => f.setValue({ mapEmbedUrl: e.target.value })}
          placeholder='<iframe src="https://www.google.com/maps/embed?pb=…"></iframe>'
        />
      </Field>
    </Shell>
  );
}
