"use server";

/**
 * Хэрэглэгч ба эрх (PROMPT 15 §2). ADMIN (user:write) — бүх эрх; MANAGER (user:write:staff) — зөвхөн STAFF.
 * Role-ийн хязгаарыг service давхаргад (users/policy.ts) дахин шалгана. Нууц үг оруулахгүй — урилгаар.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { passwordSchema } from "@/lib/validation/user";
import { clientIp } from "@/server/auth/rate-limit";
import { requireAnyPermission, requireSignedIn } from "@/server/auth/session";
import {
  cancelInvite,
  confirmPhone,
  createInvitedUser,
  editUser,
  editUserSchema,
  inviteSchema,
  requestPhoneCode,
  resendInvite,
  setTemporaryPassword,
} from "@/server/modules/users/invite";
import { parseInput, runAction } from "./result";

const refresh = (id?: string) => {
  revalidatePath("/admin/users");
  if (id) revalidatePath(`/admin/users/${id}`);
};

export async function inviteUserAction(input: z.input<typeof inviteSchema>) {
  return runAction(async () => {
    const actor = await requireAnyPermission("user:write", "user:write:staff");
    // Талбарын алдааг маягтад; хөрвүүлэлтийг service нэг удаа хийнэ
    parseInput(inviteSchema, input);
    const r = await createInvitedUser(input, actor);
    refresh();
    return r;
  });
}

export async function updateUserAction(input: z.input<typeof editUserSchema>) {
  return runAction(async () => {
    const actor = await requireAnyPermission("user:write", "user:write:staff");
    parseInput(editUserSchema, input);
    await editUser(input, actor);
    refresh(input.id);
  }, "Хэрэглэгчийн мэдээлэл хадгалагдлаа.");
}

export async function resendInviteAction(id: string) {
  return runAction(async () => {
    const actor = await requireAnyPermission("user:write", "user:write:staff");
    await resendInvite(id, actor);
    refresh(id);
  }, "Урилга дахин илгээгдлээ.");
}

export async function cancelInviteAction(id: string) {
  return runAction(async () => {
    const actor = await requireAnyPermission("user:write", "user:write:staff");
    await cancelInvite(id, actor);
    refresh(id);
  }, "Урилга цуцлагдлаа.");
}

/** Нөөц сонголт (утасгүй үед): түр нууц үг — анх нэвтрэхэд солиулна */
export async function resetPassword(input: { id: string; password: string }) {
  return runAction(async () => {
    const actor = await requireAnyPermission("user:write", "user:write:staff");
    const v = parseInput(z.object({ id: z.string().min(1), password: passwordSchema }), input);
    await setTemporaryPassword(v.id, v.password, actor);
  }, "Түр нууц үг тохируулагдлаа.");
}

/** Өөрийн утсаа баталгаажуулах (утсаар нэвтрэх) */
export async function requestPhoneCodeAction(phone: string) {
  return runAction(async () => {
    const user = await requireSignedIn();
    const r = await requestPhoneCode(user.id, phone, clientIp(await headers()));
    return { id: r.id, mask: r.mask };
  });
}

export async function confirmPhoneAction(input: { id: string; phone: string; code: string }) {
  return runAction(async () => {
    const user = await requireSignedIn();
    await confirmPhone(user.id, input);
    revalidatePath("/admin/account");
  }, "Утас баталгаажлаа. Одоо утсаараа нэвтэрч болно.");
}
