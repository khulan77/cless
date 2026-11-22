import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

/**
 * Edge/proxy-д аюулгүй тохиргоо (DB, bcrypt-гүй). Credentials provider нь
 * src/auth.ts-д нэмэгдэнэ.
 */
export const authConfig = {
  pages: { signIn: "/admin/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // 12 цаг
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      if (request.nextUrl.pathname.startsWith("/admin/login")) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
} satisfies NextAuthConfig;
