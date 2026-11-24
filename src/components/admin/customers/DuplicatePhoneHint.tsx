"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/admin/ui";
import { t } from "@/i18n";
import { findCustomerByPhoneAction } from "@/server/actions/pos";

const s = t.admin.customers;

export type ExistingCustomer = { id: string; name: string; phone: string; email: string | null };

/**
 * While a phone number is typed into a "new customer" form: once it is a full 8-digit number
 * (spaces, dashes, +976 ignored), looks up an existing customer with it and offers to pick that
 * one instead — so the same person is not registered twice.
 */
export function DuplicatePhoneHint({
  phone,
  excludeId,
  onSelect,
  selectLabel = s.duplicateSelect,
}: {
  phone: string;
  /** Editing this customer — not a duplicate of itself */
  excludeId?: string;
  onSelect: (c: ExistingCustomer) => void;
  selectLabel?: string;
}) {
  const [found, setFound] = useState<ExistingCustomer | null>(null);
  const digits = phone.replace(/\D/g, "");

  useEffect(() => {
    if (digits.length < 8) return;
    let stale = false;
    const id = setTimeout(async () => {
      const res = await findCustomerByPhoneAction(phone, excludeId);
      if (!stale) setFound(res.ok ? res.data : null);
    }, 250);
    return () => {
      stale = true;
      clearTimeout(id);
    };
  }, [phone, digits.length, excludeId]);

  if (digits.length < 8 || !found) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warn-bg px-3 py-2.5 text-[14px] text-warn">
      <span>
        {s.duplicatePhone(found.name)} — {s.duplicateAsk}
      </span>
      <Button size="sm" variant="secondary" onClick={() => onSelect(found)}>
        {selectLabel}
      </Button>
    </div>
  );
}
