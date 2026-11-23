import Link from "next/link";
import type { ReactNode } from "react";
import { btnClass } from "./ui";
import { t } from "@/i18n";

/** GET form — filters live in the URL and run server-side */
export function FilterBar({ action, children, resetHref }: { action: string; children: ReactNode; resetHref?: string }) {
  return (
    <form action={action} method="get" className="mb-6 flex flex-wrap items-end gap-3" role="search">
      {children}
      <button type="submit" className={btnClass("secondary")}>
        {t.admin.filter}
      </button>
      {resetHref && (
        <Link href={resetHref} className={btnClass("ghost")}>
          {t.admin.clearFilter}
        </Link>
      )}
    </form>
  );
}
