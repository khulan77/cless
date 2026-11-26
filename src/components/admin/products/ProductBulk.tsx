"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/admin/ui";
import { useServerAction } from "@/components/admin/use-action";
import { bulkArchiveProducts, bulkDeleteProducts } from "@/server/actions/products";

type Ctx = { selected: Set<string>; toggle: (id: string, on: boolean) => void; setAll: (ids: string[], on: boolean) => void; clear: () => void };
const Selection = createContext<Ctx | null>(null);
const useSelection = () => {
  const c = useContext(Selection);
  if (!c) throw new Error("ProductBulk: provider алга");
  return c;
};

const box = "size-[18px] cursor-pointer accent-navy";

/** Жагсаалтын сонголт (PROMPT 17 §B). Хуудас солиход сонголт арилна. */
export function ProductBulkProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ctx: Ctx = {
    selected,
    toggle: (id, on) =>
      setSelected((s) => {
        const n = new Set(s);
        if (on) n.add(id);
        else n.delete(id);
        return n;
      }),
    setAll: (ids, on) =>
      setSelected((s) => {
        const n = new Set(s);
        for (const id of ids) if (on) n.add(id); else n.delete(id);
        return n;
      }),
    clear: () => setSelected(new Set()),
  };
  return <Selection.Provider value={ctx}>{children}</Selection.Provider>;
}

export function SelectAllCheckbox({ ids }: { ids: string[] }) {
  const { selected, setAll } = useSelection();
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  const some = !all && ids.some((id) => selected.has(id));
  return (
    <input
      type="checkbox"
      className={box}
      aria-label="Бүгдийг сонгох"
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = some;
      }}
      onChange={(e) => setAll(ids, e.target.checked)}
    />
  );
}

export function RowCheckbox({ id, name }: { id: string; name: string }) {
  const { selected, toggle } = useSelection();
  return <input type="checkbox" className={box} aria-label={`${name} сонгох`} checked={selected.has(id)} onChange={(e) => toggle(id, e.target.checked)} />;
}

export function ProductBulkToolbar() {
  const router = useRouter();
  const { selected, clear } = useSelection();
  const [dialog, setDialog] = useState<"archive" | "delete" | null>(null);
  const archive = useServerAction(bulkArchiveProducts);
  const remove = useServerAction(bulkDeleteProducts);
  const n = selected.size;
  const ids = [...selected];
  const done = () => {
    setDialog(null);
    clear();
    router.refresh();
  };

  return (
    <div className="mb-3 flex min-h-10 flex-wrap items-center gap-3" aria-live="polite">
      <span className="text-[14px] text-ink-soft">{n > 0 ? `${n} сонгосон` : "Мөрийг сонгож олноор архивлах / устгах"}</span>
      {n > 0 && (
        <>
          <Button size="sm" variant="secondary" onClick={() => setDialog("archive")}>Архивлах</Button>
          <Button size="sm" variant="danger" onClick={() => setDialog("delete")}>Устгах</Button>
          <Button size="sm" variant="ghost" onClick={clear}>Сонголт цуцлах</Button>
        </>
      )}

      <ConfirmDialog
        open={dialog === "archive"}
        title={`${n} бүтээгдэхүүнийг архивлах уу?`}
        confirmLabel="Архивлах"
        pending={archive.pending}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          archive.run({ ids }, { onSuccess: (d) => (toast.success(`${d.archived} бүтээгдэхүүн архивлагдлаа (сайтаас нуугдсан).`), done()) })
        }
      >
        <p className="text-[14px]">Сайтаас нуугдана. Борлуулалтын түүх, үлдэгдэл хэвээр. Дараа нь «Нийтлэх»-ээр буцааж гаргаж болно.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "delete"}
        title={`${n} бүтээгдэхүүнийг устгах уу?`}
        confirmLabel="Устгах"
        danger
        pending={remove.pending}
        onClose={() => setDialog(null)}
        onConfirm={() => remove.run({ ids }, { onSuccess: (d) => (toast.success(d.message), done()) })}
      >
        <p className="text-[14px]">
          Бүтээгдэхүүн, хэмжээ, зураг бүрмөсөн устна — буцаах боломжгүй. Борлуулалт эсвэл агуулахын хөдөлгөөнтэй бүтээгдэхүүнийг устгахгүй, оронд нь архивлана.
        </p>
      </ConfirmDialog>
    </div>
  );
}
