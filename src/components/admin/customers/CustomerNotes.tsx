"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Textarea } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatDateTime } from "@/lib/time";
import { noteCreate, noteDelete, noteUpdate } from "@/server/actions/notes";

const N = t.admin.notes;

export type NoteView = { id: string; body: string; createdAt: string; author: string; canEdit: boolean };

/**
 * Үйлчлүүлэгчийн тэмдэглэл: цагийн дарааллаар (шинэ нь дээр), зохиогч, огноотой. Нэмэх нь эрхтэй
 * бол (`canWrite`); засах/устгах нь мөр бүрийн `canEdit`-ээр (зохиогч 24 цагт, менежер үргэлж).
 */
export function CustomerNotes({ customerId, notes, canWrite, visitId, compact }: { customerId: string; notes: NoteView[]; canWrite: boolean; visitId?: string; compact?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const create = useServerAction(noteCreate);
  const update = useServerAction(noteUpdate);
  const remove = useServerAction(noteDelete);

  return (
    <div className="space-y-4">
      {canWrite && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            void create.run({ customerId, body: text, visitId: visitId ?? null }, { onSuccess: () => (setText(""), router.refresh()) });
          }}
        >
          <label htmlFor={`note-${customerId}`} className="sr-only">
            {N.add}
          </label>
          <Textarea id={`note-${customerId}`} className={compact ? "min-h-16" : "min-h-20"} maxLength={2000} placeholder={N.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
          {create.fieldErrors.body && <p className="text-[13px] text-danger">{create.fieldErrors.body[0]}</p>}
          <Button type="submit" size="sm" disabled={create.pending || !text.trim()}>
            {N.add}
          </Button>
        </form>
      )}

      {notes.length === 0 ? (
        <p className="text-[14px] text-ink-soft">{N.empty}</p>
      ) : (
        <ol className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-hairline bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] text-ink-soft">
                  <span className="font-medium text-ink">{n.author}</span> · {formatDateTime(new Date(n.createdAt))}
                </p>
                {n.canEdit && editing?.id !== n.id && (
                  <span className="flex shrink-0 gap-1">
                    <button type="button" aria-label={N.edit} className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-ink/[0.05] hover:text-ink" onClick={() => setEditing({ id: n.id, body: n.body })}>
                      <Pencil className="size-4" strokeWidth={1.75} />
                    </button>
                    <button type="button" aria-label={N.delete} className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-err-bg hover:text-danger" onClick={() => setRemoving(n.id)}>
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </button>
                  </span>
                )}
              </div>
              {editing?.id === n.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea aria-label={N.edit} className="min-h-16" maxLength={2000} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={update.pending || !editing.body.trim()} onClick={() => update.run({ id: n.id, body: editing.body }, { onSuccess: () => (setEditing(null), router.refresh()) })}>
                      {N.save}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      {t.admin.cancel}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 whitespace-pre-line text-[15px]">{n.body}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={N.deleteTitle}
        confirmLabel={N.delete}
        danger
        pending={remove.pending}
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.run(removing!, { onSuccess: () => (setRemoving(null), router.refresh()) })}
      >
        <p className="text-[14px]">{N.deleteHint}</p>
      </ConfirmDialog>
    </div>
  );
}
