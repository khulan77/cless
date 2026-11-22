"use client";

import type { ReactNode } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./ui";
import { t } from "@/i18n";

/**
 * Admin-styled replacement for the browser confirm dialog. Built on the native <dialog>
 * (showModal): focus trap, Escape and an inert background come from the browser.
 * Pass `form` content as children; `confirmDisabled` blocks confirmation until it is valid.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  pending,
  confirmDisabled,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending && !confirmDisabled) onConfirm();
        }}
      >
        {children}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t.admin.cancel}
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={pending || confirmDisabled} autoFocus={!children}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
