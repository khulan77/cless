"use client";

import { SearchPicker } from "@/components/admin/SearchPicker";
import { t } from "@/i18n";
import { searchVariants, type VariantOption } from "@/server/actions/services";

/** Variant combobox (service consumables, bundle components) */
export function VariantPicker({ onSelect, exclude }: { onSelect: (v: VariantOption) => void; exclude: string[] }) {
  return (
    <SearchPicker
      search={searchVariants}
      exclude={exclude}
      label={t.admin.variantSearch.label}
      placeholder={t.admin.variantSearch.placeholder}
      onSelect={(o) => onSelect({ id: o.id, label: o.label, sku: o.hint ?? "" })}
    />
  );
}
