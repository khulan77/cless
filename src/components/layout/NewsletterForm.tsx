"use client";

import Link from "next/link";
import { useId } from "react";
import { t } from "@/i18n";

type Props = { placeholder: string; button: string };

/**
 * BR footer newsletter: 300×38 white field (1px #a1a6ae border, 16px inset), consent note,
 * a 300×39 light pill button. TODO: newsletter backend — UI only for now.
 */
export function NewsletterForm({ placeholder, button }: Props) {
  const id = useId();
  return (
    <form className="mt-5 max-w-[300px]" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input
        id={id}
        type="email"
        required
        autoComplete="email"
        placeholder={placeholder}
        data-br="footer.newsletterInput"
        className="h-[38px] w-full border border-silver bg-white pl-4 text-newsletter text-navy placeholder:text-navy/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      />
      <p className="mt-[25px] text-note text-silver">
        {t.footer.consent}{" "}
        <Link href="/privacy" className="text-white underline">
          {t.footer.privacy}
        </Link>
        .
      </p>
      <button
        type="submit"
        data-br="footer.newsletterButton"
        className="relative mt-5 h-[39px] w-full rounded-[24px] bg-[#edeef0] text-footer-link uppercase text-navy transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:bg-white"
      >
        {button}
      </button>
    </form>
  );
}
