"use client";

import { useId } from "react";

type Props = { placeholder: string; button: string };

/** TODO: newsletter backend — UI only for now */
export function NewsletterForm({ placeholder, button }: Props) {
  const id = useId();
  return (
    <form className="flex items-center border-b border-white/40" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input
        id={id}
        type="email"
        required
        autoComplete="email"
        placeholder={placeholder}
        className="on-dark min-w-0 flex-1 bg-transparent py-3 text-[16px] text-white placeholder:text-white/60 focus-visible:outline-none"
      />
      <button type="submit" className="on-dark shrink-0 py-3 pl-4 text-[13px] uppercase tracking-[0.6px]">
        {button}
      </button>
    </form>
  );
}
