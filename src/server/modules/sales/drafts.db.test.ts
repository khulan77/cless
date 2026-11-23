import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { makeUser, makeVariant, resetDb, variantStock } from "../../../../tests/db-helpers";
import { createDraft, discardDraft, latestDraftId, listDrafts, purgeStaleDrafts, saveDraft } from "./drafts";
import { checkout, unlock } from "./service";

let manager: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  manager = await makeUser("MANAGER");
});

const line = (variantId: string, qty = 1) => ({ key: "l1", kind: "PRODUCT" as const, refId: variantId, name: "SERUM", detail: "30 мл", unitPrice: 100_000, qty, staffId: "", discount: null, discountReason: "" });

describe("POS drafts", () => {
  it("autosave creates then updates one DRAFT without reserving stock; latest draft is found", async () => {
    const v = await makeVariant({ price: 100_000, stock: 3 });
    const a = await saveDraft({ data: { lines: [line(v.id)], visit: { notes: "хуурай" } } }, manager.id);
    const b = await saveDraft({ saleId: a.saleId, data: { lines: [line(v.id, 2)], visit: { notes: "хуурай арьс" } } }, manager.id);
    expect(b.saleId).toBe(a.saleId);
    const sale = await db.sale.findUniqueOrThrow({ where: { id: a.saleId } });
    expect(sale.status).toBe("DRAFT");
    expect(sale.number).toBeNull();
    expect((sale.draftData as { lines: { qty: number }[]; visit: { notes: string } }).lines[0]!.qty).toBe(2);
    expect((sale.draftData as { visit: { notes: string } }).visit.notes).toBe("хуурай арьс");
    expect(await variantStock(v.id)).toEqual({ stock: 3, reserved: 0 });
    expect(await latestDraftId(manager.id)).toBe(a.saleId);
    expect((await listDrafts(manager.id)).map((d) => d.lines)).toEqual([1]);
  });

  it("several drafts in parallel; checkout locks the draft and clears draftData; saving a locked draft fails", async () => {
    const v = await makeVariant({ price: 100_000, stock: 3 });
    const first = await saveDraft({ data: { lines: [line(v.id)] } }, manager.id);
    const second = await createDraft(manager.id);
    expect((await listDrafts(manager.id)).length).toBe(2);
    await checkout({ saleId: first.saleId, items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, { id: manager.id, role: "MANAGER" });
    const locked = await db.sale.findUniqueOrThrow({ where: { id: first.saleId } });
    expect(locked.status).toBe("PENDING_PAYMENT");
    expect(locked.draftData).toBeNull();
    await expect(saveDraft({ saleId: first.saleId, data: {} }, manager.id)).rejects.toThrow(/төлбөрт шилжсэн/);
    expect((await listDrafts(manager.id)).map((d) => d.id)).toEqual([second]);
    // Unlock → дахин ноорог (мөрүүдтэй, дугаар хэвээр)
    await unlock(first.saleId, manager.id);
    expect(await latestDraftId(manager.id)).toBeTruthy();
  });

  it("discard deletes an un-numbered draft and cancels a numbered (unlocked) one", async () => {
    const v = await makeVariant({ price: 100_000, stock: 3 });
    const plain = await createDraft(manager.id);
    expect(await discardDraft(plain)).toBe("DELETED");
    const r = await checkout({ items: [{ kind: "PRODUCT", variantId: v.id, qty: 1 }] }, { id: manager.id, role: "MANAGER" });
    await unlock(r.saleId, manager.id);
    expect(await discardDraft(r.saleId)).toBe("CANCELLED");
    expect((await db.sale.findUniqueOrThrow({ where: { id: r.saleId } })).number).toBe(r.number);
  });

  it("purges drafts untouched for 24h", async () => {
    const old = await createDraft(manager.id);
    const fresh = await createDraft(manager.id);
    await db.$executeRaw`UPDATE "Sale" SET "updatedAt" = ${new Date(Date.now() - 25 * 3600_000)} WHERE "id" = ${old}`;
    expect(await purgeStaleDrafts(24)).toBe(1);
    expect(await db.sale.findUnique({ where: { id: old } })).toBeNull();
    expect(await db.sale.findUnique({ where: { id: fresh } })).not.toBeNull();
  });
});
