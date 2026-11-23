import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/*
 * Admin design kit — one place for the look (tokens live in globals.css @theme).
 * Calm, roomy, readable: 15px body, 44px controls, 16px card radius, serif page titles.
 */

/* ─── Buttons ─── */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
type BtnSize = "sm" | "md";
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 whitespace-nowrap";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-navy text-white hover:bg-[#1a3260]",
  secondary: "border border-hairline bg-white text-ink hover:border-ink/25 hover:bg-canvas",
  ghost: "text-ink hover:bg-ink/[0.05]",
  // Destructive: red text only, no fill
  danger: "text-danger hover:bg-err-bg",
};
const btnSizes: Record<BtnSize, string> = { sm: "h-9 px-3.5 text-[14px]", md: "h-11 px-5 text-[15px]" };

export function btnClass(variant: BtnVariant = "primary", size: BtnSize = "md", extra = "") {
  return `${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: BtnVariant; size?: BtnSize }) {
  return <button type={type} className={btnClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className = "", ...props }: ComponentPropsWithoutRef<typeof Link> & { variant?: BtnVariant; size?: BtnSize }) {
  return <Link className={btnClass(variant, size, className)} {...props} />;
}

/** Square icon-only button — always pass an aria-label */
export function IconButton({ className = "", label, children, ...props }: ComponentPropsWithoutRef<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-grid size-11 shrink-0 place-items-center rounded-xl text-ink-soft transition-colors duration-150 hover:bg-ink/[0.05] hover:text-ink disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ─── Form fields ─── */
export const inputClass =
  "h-11 rounded-xl border border-hairline bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-faint transition-colors duration-150 hover:border-ink/20 focus:border-navy focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-champagne/30 aria-[invalid=true]:border-danger disabled:bg-canvas disabled:text-ink-soft";

/** Full width unless the caller sets its own width */
const widthOf = (className: string) => (/(^|\s)(w-|max-w-|min-w-)/.test(className) ? "" : "w-full");

export function Input({ className = "", ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={`${inputClass} ${widthOf(className)} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={`${inputClass} h-auto min-h-24 w-full py-2.5 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={`${inputClass} ${widthOf(className)} pr-9 ${className}`} {...props} />;
}

export function Checkbox({ label, className = "", ...props }: ComponentPropsWithoutRef<"input"> & { label: ReactNode }) {
  return (
    <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] ${className}`}>
      <input type="checkbox" className="size-[18px] accent-navy" {...props} />
      {label}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: string[] | string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="block text-[14px] font-medium text-ink">
        {label}
      </label>
      {children}
      {msg ? (
        <p className="text-[13px] text-danger" role="alert">
          {msg}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

/* ─── Layout ─── */
/** Serif title + one plain sentence about the page + the main action on the right */
/** "— ТОЙМ" eyebrow, serif title ending in a champagne dot ("Тайлан."), one plain sentence, main action on the right */
export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2.5 flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-champagne-ink">
            <span aria-hidden className="h-px w-6 bg-champagne" />
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[36px] font-bold leading-[1.08] tracking-[-0.015em] text-ink">
          {title}
          <span aria-hidden className="text-champagne">.</span>
        </h1>
        {description && <p className="mt-2 text-[15px] text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, children, className = "", actions, flush }: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  /** No inner padding (tables, lists) */
  flush?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-hairline bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-4 px-6 pb-1 pt-5">
          <div>
            {title && <h2 className="font-display text-[22px] font-semibold leading-tight text-ink">{title}</h2>}
            {description && <p className="mt-1 text-[14px] text-ink-soft">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={flush ? "" : "px-6 pb-6 pt-4"}>{children}</div>
    </section>
  );
}

/** Big number tile (dashboard, reports) */
export function StatCard({ label, value, hint, href, tone = "default", icon: Icon }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: "default" | "dark" | "alert";
  icon?: LucideIcon;
}) {
  const dark = tone === "dark";
  const body = (
    <>
      <p className={`flex items-center gap-2 text-[14px] ${dark ? "text-white/70" : "text-ink-soft"}`}>
        {Icon && <Icon className="size-4" strokeWidth={1.75} aria-hidden />}
        {label}
      </p>
      <p className={`mt-3 text-[30px] font-medium leading-none tabular-nums ${dark ? "text-white" : tone === "alert" ? "text-err" : "text-ink"}`}>{value}</p>
      {hint && <p className={`mt-2 text-[13px] ${dark ? "text-white/60" : "text-ink-soft"}`}>{hint}</p>}
    </>
  );
  const cls = `block rounded-2xl border p-5 transition-colors duration-150 ${dark ? "border-navy bg-navy" : "border-hairline bg-white"} ${href ? (dark ? "hover:bg-[#1a3260]" : "hover:border-ink/20") : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ─── Segmented tabs (pill) ─── */
export type Segment<T extends string> = { value: T; label: ReactNode; href?: string };

/** "Өдөр / 7 хоног"-style pill switch. With `href` each segment is a link (server pages). */
export function SegmentedTabs<T extends string>({ items, value, onChange, label, className = "" }: {
  items: Segment<T>[];
  value: T;
  onChange?: (v: T) => void;
  label: string;
  className?: string;
}) {
  const cls = (on: boolean) =>
    `inline-flex h-9 items-center rounded-full px-4 text-[14px] transition-colors duration-150 ${on ? "bg-white font-medium text-ink shadow-[0_1px_2px_rgba(28,34,48,0.08)]" : "text-ink-soft hover:text-ink"}`;
  return (
    <div role="tablist" aria-label={label} className={`inline-flex items-center gap-0.5 rounded-full bg-ink/[0.05] p-1 ${className}`}>
      {items.map((it) =>
        it.href ? (
          <Link key={it.value} href={it.href} role="tab" aria-selected={value === it.value} className={cls(value === it.value)}>
            {it.label}
          </Link>
        ) : (
          <button key={it.value} type="button" role="tab" aria-selected={value === it.value} onClick={() => onChange?.(it.value)} className={cls(value === it.value)}>
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}

/* ─── Badges ─── */
type Tone = "neutral" | "green" | "red" | "amber" | "navy" | "info" | "champagne";
const tones: Record<Tone, string> = {
  neutral: "bg-ink/[0.06] text-ink-soft",
  green: "bg-ok-bg text-ok",
  red: "bg-err-bg text-err",
  amber: "bg-warn-bg text-warn",
  info: "bg-info-bg text-info",
  navy: "bg-navy text-white",
  champagne: "bg-champagne/15 text-[#6f5733]",
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium leading-5 ${tones[tone]}`}>{children}</span>;
}

/* ─── Avatar ─── */
/** Soft pastel palette (calendar cards + avatars). `bar` = the darker left stripe / initials colour. */
export const PASTELS = [
  { bg: "#E6EEF7", bar: "#4D6E95" },
  { bg: "#EDE7F3", bar: "#74609A" },
  { bg: "#E5F0EA", bar: "#4C7A5E" },
  { bg: "#F6EBDD", bar: "#9A7240" },
  { bg: "#F5E5E7", bar: "#9A5762" },
  { bg: "#E3EFF0", bar: "#3F7579" },
  { bg: "#F1EEDF", bar: "#7C7340" },
  { bg: "#ECE8E4", bar: "#6F655C" },
] as const;

/** Stable colour per id (same staff member → same colour everywhere) */
export function pastelFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PASTELS[h % PASTELS.length]!;
}

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  // "Гоо сайханч Сараа" → the last word is the person's name
  const w = words.length > 2 ? words.slice(-1) : words;
  return (w.length === 1 ? w[0]!.slice(0, 2) : w.map((x) => x[0]).join("").slice(0, 2)).toUpperCase();
}

export function Avatar({ name, id, size = 36 }: { name: string; id?: string; size?: number }) {
  const c = pastelFor(id ?? name);
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full font-medium"
      style={{ width: size, height: size, background: c.bg, color: c.bar, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

/* ─── Lists ─── */
/** Service-style row: letter tile, name, "price · duration", outline "Засах" + red "Устгах" on the right */
export function ListRow({ title, meta, tag, href, actions, letterSeed }: {
  title: ReactNode;
  meta?: ReactNode;
  tag?: ReactNode;
  href?: string;
  actions?: ReactNode;
  letterSeed?: string;
}) {
  const letter = typeof title === "string" ? title.trim().charAt(0).toUpperCase() : "•";
  const c = pastelFor(letterSeed ?? (typeof title === "string" ? title : "x"));
  return (
    <div className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-hairline bg-white px-4 py-3 transition-colors duration-150 hover:border-ink/15">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl font-display text-[20px] font-semibold" style={{ background: c.bg, color: c.bar }}>
        {letter}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-ink">
          {href ? (
            <Link href={href} className="truncate hover:underline">
              {title}
            </Link>
          ) : (
            <span className="truncate">{title}</span>
          )}
          {tag}
        </p>
        {meta && <p className="mt-0.5 text-[14px] text-ink-soft tabular-nums">{meta}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

/** Outline pill action ("Засах") */
export function PillLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`inline-flex h-9 items-center rounded-full border border-hairline bg-white px-4 text-[14px] font-medium text-ink transition-colors duration-150 hover:border-ink/25 ${className}`}>
      {children}
    </Link>
  );
}

/* ─── Empty / loading ─── */
export function EmptyState({ title, children, icon: Icon, action }: { title: string; children?: ReactNode; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-hairline bg-white px-6 py-14 text-center">
      {Icon && <Icon className="mx-auto mb-3 size-8 text-champagne-ink" strokeWidth={1.5} aria-hidden />}
      <p className="text-[16px] font-medium text-ink">{title}</p>
      {children && <div className="mt-1.5 text-[15px] text-ink-soft">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-ink/[0.06] motion-reduce:animate-none ${className}`} />;
}

/* ─── Table ─── */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-hairline bg-white">
      <table className="w-full min-w-[720px] border-collapse text-[14px] [&_tbody_tr:hover]:bg-canvas [&_tbody_tr:last-child_td]:border-b-0">{children}</table>
    </div>
  );
}
export const thClass = "h-12 border-b border-hairline px-4 text-left text-[13px] font-medium text-ink-soft";
export const tdClass = "h-14 border-b border-hairline px-4 py-2.5 align-middle";
