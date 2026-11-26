/**
 * Санхүүгийн хэсгийн хандалт. ADMIN, ACCOUNTANT — статик эрх (permissions.ts).
 * MANAGER — тохиргоогоор зөвхөн ХАРАХ (finance/settings.ts). STAFF — хэзээ ч үгүй.
 */
import "server-only";
import { forbidden } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { getFinanceSettings } from "./settings";

export type FinanceArea = "expenses" | "finance";

export async function canView(role: Role | null | undefined, area: FinanceArea): Promise<boolean> {
  if (!role) return false;
  if (can(role, area === "expenses" ? "expense:read" : "finance:read")) return true;
  if (role !== "MANAGER") return false;
  const s = await getFinanceSettings();
  return area === "expenses" ? s.managerExpenses : s.managerFinance;
}

/** Хуудсанд: харах эрхгүй бол 403. canWrite — бүртгэх/засах товч харуулах эсэх. */
export async function requireFinancePage(area: FinanceArea) {
  const user = await requireUser();
  if (!(await canView(user.role, area))) forbidden();
  return { user, canWrite: can(user.role, "expense:write") };
}
