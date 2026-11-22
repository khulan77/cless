"use server";

import type { z } from "zod";
import { signOut } from "@/auth";
import { requireSignedIn } from "@/server/auth/session";
import { changeOwnPassword, changePasswordSchema } from "@/server/modules/users/password";
import { parseInput, runAction } from "./result";

/** Өөрийн нууц үг солих (түр нууц үгтэй байсан ч) → бүх session хүчингүй → дахин нэвтрэх */
export async function changePasswordAction(input: z.input<typeof changePasswordSchema>) {
  return runAction(async () => {
    const user = await requireSignedIn();
    const data = parseInput(changePasswordSchema, input);
    await changeOwnPassword(user.id, data);
    await signOut({ redirectTo: "/admin/login?changed=1" });
  });
}
