"use server";

/**
 * Санхүү (PROMPT 18): зардал, ангилал, санхүүгийн тохиргоо. Бичих эрх — expense:write (ADMIN, ACCOUNTANT).
 * Бүх засвар AuditLog-д (module давхаргад).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { categoryInputSchema, createExpense, deleteExpense, expenseInputSchema, saveCategory, updateExpense } from "@/server/modules/finance/expenses";
import { removeReceipt, storeReceipt } from "@/server/modules/finance/receipts";
import { saveFinanceSettings, saveFinanceSettingsSchema } from "@/server/modules/finance/settings";
import { parseInput, runAction } from "./result";

const refresh = () => {
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/finance");
};

/** FormData → оролт (баримтын файл тусдаа) */
function fromForm(fd: FormData) {
  const str = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return {
    input: {
      categoryId: str("categoryId") ?? "",
      date: str("date") ?? "",
      amount: Number(str("amount") ?? ""),
      vatIncluded: str("vatIncluded") === "on" || str("vatIncluded") === "true",
      reference: str("reference"),
      vendor: str("vendor"),
      note: str("note"),
      paidVia: (str("paidVia") || null) as z.input<typeof expenseInputSchema>["paidVia"],
    },
    file: fd.get("receipt") instanceof File ? (fd.get("receipt") as File) : null,
    removeReceipt: str("removeReceipt") === "1",
  };
}

export async function createExpenseAction(fd: FormData) {
  return runAction(async () => {
    const user = await requirePermission("expense:write");
    const { input, file } = fromForm(fd);
    const v = parseInput(expenseInputSchema, input);
    const receiptPath = await storeReceipt(file);
    try {
      const e = await createExpense(v, user.id, { receiptPath });
      refresh();
      return { id: e.id };
    } catch (err) {
      await removeReceipt(receiptPath);
      throw err;
    }
  }, "Зардал бүртгэгдлээ.");
}

export async function updateExpenseAction(expenseId: string, fd: FormData) {
  return runAction(async () => {
    const user = await requirePermission("expense:write");
    const { input, file, removeReceipt: drop } = fromForm(fd);
    const v = parseInput(expenseInputSchema, input);
    const receiptPath = file && file.size > 0 ? await storeReceipt(file) : drop ? null : undefined;
    try {
      const r = await updateExpense(z.string().min(1).parse(expenseId), v, user.id, receiptPath === undefined ? {} : { receiptPath });
      await removeReceipt(r.oldReceipt);
      refresh();
    } catch (err) {
      if (receiptPath) await removeReceipt(receiptPath);
      throw err;
    }
  }, "Зардал засагдлаа.");
}

export async function deleteExpenseAction(expenseId: string) {
  return runAction(async () => {
    const user = await requirePermission("expense:write");
    const r = await deleteExpense(z.string().min(1).parse(expenseId), user.id);
    await removeReceipt(r.receiptPath);
    refresh();
  }, "Зардал устгагдлаа.");
}

export async function saveExpenseCategoryAction(categoryId: string | null, input: z.input<typeof categoryInputSchema>) {
  return runAction(async () => {
    const user = await requirePermission("expense:write");
    await saveCategory(categoryId, parseInput(categoryInputSchema, input), user.id);
    refresh();
    revalidatePath("/admin/finance/settings");
  }, "Ангилал хадгалагдлаа.");
}

export async function saveFinanceSettingsAction(input: z.input<typeof saveFinanceSettingsSchema>) {
  return runAction(async () => {
    const user = await requirePermission("expense:write");
    await saveFinanceSettings(parseInput(saveFinanceSettingsSchema, input), user.id);
    refresh();
    revalidatePath("/admin/finance/settings");
  }, "Санхүүгийн тохиргоо хадгалагдлаа.");
}
