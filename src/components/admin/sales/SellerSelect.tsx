"use client";

import { useServerAction } from "@/components/admin/use-action";
import { Select } from "@/components/admin/ui";
import { t } from "@/i18n";
import { setItemSellerAction } from "@/server/actions/pos";

/** Борлуулалтын дараа бүтээгдэхүүний мөрийн "Зарсан" ажилтныг засах (ADMIN, MANAGER) — AuditLog-д */
export function SellerSelect({ saleId, itemId, value, options }: { saleId: string; itemId: string; value: string; options: { id: string; name: string }[] }) {
  const { run, pending } = useServerAction(setItemSellerAction);
  const s = t.admin.pos;
  return (
    <Select
      aria-label={s.seller}
      title={s.sellerHint}
      value={value}
      disabled={pending}
      onChange={(e) => run({ itemId, saleId, sellerId: e.target.value || null })}
      className="mt-1 h-9 w-56 text-[13px]"
    >
      <option value="">{s.sellerPrefix} —</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {s.sellerPrefix} {o.name}
        </option>
      ))}
    </Select>
  );
}
