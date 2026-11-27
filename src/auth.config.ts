import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

/**
 * Edge/proxy-д аюулгүй тохиргоо (DB, bcrypt-гүй). Credentials provider нь
 * src/auth.ts-д нэмэгдэнэ.
 */
export const authConfig = {
  pages: { signIn: "/admin/login" },
  // 12 цаг идэвхгүй бол гарна: JWT 15 минут тутам шинэчлэгдэж (updateAge) хугацаа нь сунна
  session: { strategy: "jwt", maxAge: 60 * 60 * 12, updateAge: 60 * 15 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      // Нэвтрээгүй хандах боломжтой: нэвтрэх, урилга идэвхжүүлэх, нууц үг сэргээх
      const p = request.nextUrl.pathname;
      // PROMPT 24: proxy бүх замд ажиллана — нэвтрэлт зөвхөн /admin-д шаардлагатай
      if (!p.startsWith("/admin")) return true;
      if (p.startsWith("/admin/login") || p.startsWith("/admin/activate") || p.startsWith("/admin/forgot")) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as { role: Role }).role;
        // Нууц үг солигдсон мөч — session-ийг хүчингүй болгоход (src/server/auth/session.ts)
        token.pwdAt = (user as { pwdAt?: number }).pwdAt ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as Role;
      session.user.pwdAt = (token.pwdAt as number | undefined) ?? 0;
      return session;
    },
  },
} satisfies NextAuthConfig;
