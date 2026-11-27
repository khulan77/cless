"use server";

/**
 * Багц үйлчилгээ (PROMPT 27 §4). Эрх: загвар, тохиргоо — package:write (ACCOUNTANT, ADMIN);
 * цагт ашиглах, буруу хасалт буцаах — package:redeem (MANAGER, ADMIN); багц цуцлах — package:refund (ADMIN).
 */
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import {
  attachPackage,
  packageSettingsSchema,
  refundPackage,
  refundPackageSchema,
  reverseRedemption,
  reverseSchema,
  savePackageSettings,
  saveTemplate,
  templateSchema,
  usablePackages,
} from "@/server/modules/packages/service";
import { parseInput, runAction } from "./result";

const refresh = () => {
  revalidatePath("/admin/services/packages");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/customers", "layout");
};

export async function saveTemplateAction(templateId: string | null, input: z.input<typeof templateSchema>) {
  return runAction(async () => {
    const user = await requirePermission("package:write");
    const t = await saveTemplate(templateId, parseInput(templateSchema, input), user.id);
    refresh();
    revalidatePath("/services");
    updateTag("packages");
    return { id: t.id, price: t.price };
  }, "Багц хадгалагдлаа.");
}

export async function savePackageSettingsAction(input: z.input<typeof packageSettingsSchema>) {
  return runAction(async () => {
    const user = await requirePermission("package:write");
    await savePackageSettings(parseInput(packageSettingsSchema, input), user.id);
    refresh();
  }, "Тохиргоо хадгалагдлаа.");
}

/** Цагт ашиглаж болох багцууд (хамгийн түрүүнд дуусахыг эхэнд) + одоо холбосон */
export async function appointmentPackagesAction(appointmentId: string) {
  return runAction(async () => {
    await requirePermission("package:redeem");
    const a = await db.appointment.findUnique({
      where: { id: String(appointmentId) },
      select: {
        customerId: true,
        serviceId: true,
        customerPackageId: true,
        customerPackage: { select: { name: true, usedSessions: true, totalSessions: true } },
        packageRedemption: { select: { id: true, reversedAt: true, unitValue: true } },
      },
    });
    if (!a) throw new UserError("Цаг олдсонгүй.");
    return {
      attached: a.customerPackageId ? { id: a.customerPackageId, name: a.customerPackage!.name, used: a.customerPackage!.usedSessions, total: a.customerPackage!.totalSessions } : null,
      redemption: a.packageRedemption && !a.packageRedemption.reversedAt ? { id: a.packageRedemption.id, unitValue: a.packageRedemption.unitValue } : null,
      usable: await usablePackages(a.customerId, a.serviceId),
    };
  });
}

export async function attachPackageAction(input: { appointmentId: string; customerPackageId: string | null }) {
  return runAction(async () => {
    const user = await requirePermission("package:redeem");
    const v = parseInput(z.object({ appointmentId: z.string().min(1), customerPackageId: z.string().min(1).nullable() }), input);
    await attachPackage(v.appointmentId, v.customerPackageId, user.id);
    refresh();
  }, "Хадгалагдлаа.");
}

export async function reverseRedemptionAction(input: z.input<typeof reverseSchema>) {
  return runAction(async () => {
    const user = await requirePermission("package:redeem");
    await reverseRedemption(parseInput(reverseSchema, input), user.id);
    refresh();
  }, "Хасалтыг буцаалаа.");
}

export async function refundPackageAction(input: z.input<typeof refundPackageSchema>) {
  return runAction(async () => {
    const user = await requirePermission("package:refund");
    const r = await refundPackage(parseInput(refundPackageSchema, input), user.id);
    refresh();
    return r;
  }, "Багц цуцлагдлаа.");
}
