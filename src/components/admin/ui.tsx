import type { ComponentPropsWithoutRef, ReactNode } from "react";

/* ─── Buttons ─── */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
type BtnSize = "sm" | "md";
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy/90",
  secondary: "border border-line bg-white text-navy hover:bg-navy/5",
  ghost: "text-navy hover:bg-navy/5",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};
const btnSizes: Record<BtnSize, string> = { sm: "h-8 px-2.5 text-[13px]", md: "h-9 px-3.5 text-[14px]" };

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

/* ─── Form fields ─── */
export const inputClass =
  "h-9 rounded-md border border-line bg-white px-3 text-[14px] text-navy placeholder:text-navy/40 focus:border-navy focus:outline-none focus-visible:outline-none aria-[invalid=true]:border-red-500 disabled:bg-navy/5";

export function Input({ className = "", ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={`${inputClass} w-full ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={`${inputClass} h-auto min-h-24 w-full py-2 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={`${inputClass} w-full pr-8 ${className}`} {...props} />;
}

export function Checkbox({ label, className = "", ...props }: ComponentPropsWithoutRef<"input"> & { label: ReactNode }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-[14px] ${className}`}>
      <input type="checkbox" className="size-4 accent-navy" {...props} />
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
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-navy/80">
        {label}
      </label>
      {children}
      {msg ? (
        <p className="text-[12px] text-red-600" role="alert">
          {msg}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-navy/50">{hint}</p>
      ) : null}
    </div>
  );
}

/* ─── Layout ─── */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-medium tracking-[-0.2px]">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-navy/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, children, className = "", actions }: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`rounded-lg border border-line bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div>
            {title && <h2 className="text-[15px] font-medium">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-navy/55">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

type Tone = "neutral" | "green" | "red" | "amber" | "navy";
const tones: Record<Tone, string> = {
  neutral: "bg-navy/5 text-navy/70",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-800",
  navy: "bg-navy text-white",
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {children && <div className="mt-2 text-[14px] text-navy/60">{children}</div>}
    </div>
  );
}

/* ─── Table ─── */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[720px] border-collapse text-[13.5px]">{children}</table>
    </div>
  );
}
export const thClass =
  "border-b border-line bg-navy/[0.03] px-3 py-2.5 text-left text-[12px] font-medium uppercase tracking-[0.4px] text-navy/60";
export const tdClass = "border-b border-line/60 px-3 py-2.5 align-middle";
