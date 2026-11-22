"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export type LoginState = { error?: string; email?: string };

/** proxy-ийн callbackUrl-ыг зөвхөн /admin доторх зам болгож цэвэрлэнэ (open redirect хамгаалалт) */
function safeCallback(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || !raw) return "/admin";
  try {
    const url = new URL(raw, "http://localhost");
    if (url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login")) {
      return url.pathname + url.search;
    }
  } catch {
    // үл тооно
  }
  return "/admin";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: safeCallback(formData.get("callbackUrl")),
    });
    return {};
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code;
      if (code === "rate_limited") {
        return { email, error: "Хэт олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу." };
      }
      return { email, error: "Имэйл эсвэл нууц үг буруу байна." };
    }
    throw e; // амжилттай үед NEXT_REDIRECT
  }
}

export async function logout() {
  await signOut({ redirectTo: "/admin/login" });
}
