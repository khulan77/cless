"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Input } from "@/components/admin/ui";
import { setAttendanceNoteAction } from "@/server/actions/attendance";

/** Ирцийн тайлбар — цагт нөлөөлөхгүй (PROMPT 20) */
export function NoteCell({ staffId, date, initial, name }: { staffId: string; date: string; initial: string | null; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(initial ?? "");
  const { run, pending } = useServerAction(setAttendanceNoteAction);
  if (!editing)
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-left text-[13px] text-ink-soft underline-offset-4 hover:underline">
        {initial ?? "+ Тайлбар"}
      </button>
    );
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run({ staffId, date, note }, { onSuccess: () => (setEditing(false), router.refresh()) });
      }}
    >
      <Input aria-label={`${name} — тайлбар`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="h-9 min-w-48" autoFocus />
      <Button type="submit" size="sm" disabled={pending}>Хадгалах</Button>
    </form>
  );
}
