import Link from "next/link";
import { btnClass } from "./ui";
import { t } from "@/i18n";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
};

export function Pagination({ page, pageSize, total, basePath, params }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    else sp.delete("page");
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav aria-label={t.admin.pagination.label} className="mt-4 flex items-center justify-between text-[13px] text-navy/60">
      <p>
        {t.admin.pagination.range(from, to, total)}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={btnClass("secondary", "sm")}>
            {t.admin.pagination.prev}
          </Link>
        ) : (
          <span className={btnClass("secondary", "sm", "pointer-events-none opacity-40")}>{t.admin.pagination.prev}</span>
        )}
        <span>
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={btnClass("secondary", "sm")}>
            {t.admin.pagination.next}
          </Link>
        ) : (
          <span className={btnClass("secondary", "sm", "pointer-events-none opacity-40")}>{t.admin.pagination.next}</span>
        )}
      </div>
    </nav>
  );
}

/** Safely reads `page` from searchParams */
export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

export function str(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() || undefined;
}
