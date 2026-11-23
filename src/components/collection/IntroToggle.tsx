"use client";

import { useId, useState } from "react";
import { t } from "@/i18n";

const PREVIEW = 60;

/** Shows the first ~60 chars of the intro with "read more" / "read less" */
export function IntroToggle({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const needsToggle = text.length > PREVIEW + 10;
  const preview = needsToggle ? `${text.slice(0, text.lastIndexOf(" ", PREVIEW) > 20 ? text.lastIndexOf(" ", PREVIEW) : PREVIEW)}…` : text;

  return (
    <p id={id} className="mx-auto mt-3 max-w-[60ch] text-[15px] text-white/90">
      {open || !needsToggle ? text : preview}{" "}
      {needsToggle && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="on-dark link-underline inline-flex min-h-11 items-center whitespace-nowrap md:min-h-0"
        >
          {open ? t.collection.readLess : t.collection.readMore}
        </button>
      )}
    </p>
  );
}
