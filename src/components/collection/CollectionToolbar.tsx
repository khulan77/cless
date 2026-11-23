import Link from "next/link";
import { t } from "@/i18n";
import type { CollectionLink } from "@/server/queries/catalog";
import { CollectionSwitcher } from "./CollectionSwitcher";

type Props = {
  current: CollectionLink;
  siblings: CollectionLink[];
  parent: CollectionLink | null;
  subcategories: CollectionLink[];
  total: number;
};

export function CollectionToolbar({ current, siblings, parent, subcategories, total }: Props) {
  return (
    <div className="flex min-h-16 flex-wrap items-center gap-x-6 gap-y-2 border-b border-line py-3">
      <CollectionSwitcher current={current} siblings={siblings} parent={parent} />
      {subcategories.length > 0 && (
        <nav aria-label={t.collection.subcategories} className="-mx-4 min-w-0 flex-1 px-4 md:mx-0 md:px-0">
          <ul className="no-scrollbar flex gap-2 overflow-x-auto">
            {subcategories.map((s) => (
              <li key={s.slug} className="shrink-0">
                <Link
                  href={s.href}
                  className="relative inline-flex h-8 items-center rounded-full border border-line px-3.5 text-button transition-colors before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:border-navy"
                >
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <p className="ml-auto text-meta text-muted">{t.collection.productCount(total)}</p>
    </div>
  );
}
