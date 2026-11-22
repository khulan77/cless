"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useServerAction } from "@/components/admin/use-action";
import { Button, Checkbox, Input } from "@/components/admin/ui";
import { t } from "@/i18n";
import { deleteRoomAction, saveRoomAction } from "@/server/actions/appointments";

const r = t.admin.rooms;
type Room = { id: string; name: string; isActive: boolean; sortOrder: number };

function RoomRow({ room }: { room: Room }) {
  const router = useRouter();
  const [v, setV] = useState(room);
  const [confirm, setConfirm] = useState(false);
  const save = useServerAction(saveRoomAction);
  const del = useServerAction(deleteRoomAction);
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <Input aria-label={r.name} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-8 w-56" />
      <Input aria-label={r.sortOrder} type="number" min={0} value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) || 0 })} className="h-8 w-20" />
      <Checkbox label={r.active} checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />
      <Button size="sm" variant="secondary" disabled={save.pending} onClick={() => save.run(v, { onSuccess: () => router.refresh() })}>
        {r.save}
      </Button>
      <button type="button" aria-label={`${r.delete}: ${room.name}`} className="ml-auto rounded p-1 text-navy/45 hover:text-red-700" onClick={() => setConfirm(true)}>
        <Trash2 className="size-4" />
      </button>
      <ConfirmDialog
        open={confirm}
        title={r.deleteTitle}
        confirmLabel={r.delete}
        danger
        pending={del.pending}
        onClose={() => setConfirm(false)}
        onConfirm={() => del.run(room.id, { onSuccess: () => (setConfirm(false), router.refresh()) })}
      >
        <p className="text-[14px]">{room.name}</p>
      </ConfirmDialog>
    </li>
  );
}

export function RoomsEditor({ rooms }: { rooms: Room[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const add = useServerAction(saveRoomAction);
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-navy/60">{r.hint}</p>
      {rooms.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[14px] text-navy/60">{r.empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {rooms.map((room) => (
            <RoomRow key={`${room.id}:${room.name}:${room.isActive}:${room.sortOrder}`} room={room} />
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add.run({ name, isActive: true, sortOrder: rooms.length }, { onSuccess: () => (setName(""), router.refresh()) });
        }}
      >
        <Input aria-label={r.name} placeholder={r.name} value={name} onChange={(e) => setName(e.target.value)} className="w-64" />
        <Button type="submit" disabled={add.pending || !name.trim()}>
          {r.add}
        </Button>
      </form>
    </div>
  );
}
