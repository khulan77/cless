"use client";

import { inputClass } from "./ui";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * Мөнгөний input: "1,250,000" гэж мянгатын таслалтай харуулна, утга нь Int (төгрөг).
 * Хоосон бол NaN — zod "Тоо оруулна уу" алдаа өгнө.
 */
export function MoneyInput({
  value,
  onChange,
  className = "",
  invalid,
  ...props
}: Omit<React.ComponentPropsWithoutRef<"input">, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (v: number) => void;
  invalid?: boolean;
}) {
  const display = value === null || Number.isNaN(value) ? "" : fmt.format(value);
  return (
    <div className="relative">
      <input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 12);
          onChange(digits === "" ? Number.NaN : Number(digits));
        }}
        className={`${inputClass} pr-7 text-right tabular-nums ${invalid ? "border-red-500" : ""} ${className}`}
      />
      <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-navy/40">
        ₮
      </span>
    </div>
  );
}
