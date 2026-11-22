import Link from "next/link";
import type { ReactNode } from "react";
import { btnClass } from "./ui";

/** GET форм — шүүлтүүр URL-д хадгалагдаж, server-side ажиллана */
export function FilterBar({ action, children, resetHref }: { action: string; children: ReactNode; resetHref?: string }) {
  return (
    <form action={action} method="get" className="mb-4 flex flex-wrap items-end gap-2" role="search">
      {children}
      <button type="submit" className={btnClass("secondary")}>
        Шүүх
      </button>
      {resetHref && (
        <Link href={resetHref} className={btnClass("ghost")}>
          Цэвэрлэх
        </Link>
      )}
    </form>
  );
}
