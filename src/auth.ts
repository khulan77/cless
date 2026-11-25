import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/server/db";
import { clientIp, isLoginBlocked, recordLoginAttempt } from "@/server/auth/rate-limit";
import { identifierWhere, normalizeIdentifier } from "@/server/modules/users/invite";

export class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

// "email" талбар = утас ЭСВЭЛ имэйл (PROMPT 15): "99112233" / "+976 9911-2233" / "a@b.mn"
const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(200),
  password: z.string().min(1).max(200),
});

// Хэрэглэгч олдоогүй үед ч bcrypt ажиллуулж хариу өгөх хугацааг тэнцүүлнэ.
const DUMMY_HASH = "$2b$12$7wa3PuGaCAKwfAbL.9mGlehzb2Zutjl6AhyqBuw3smbFx.MUgbpaC";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { password } = parsed.data;
        const ip = clientIp(request.headers);
        // Түгжээний түлхүүр: хэвийн болгосон утас/имэйл
        const email = normalizeIdentifier(parsed.data.email) ?? parsed.data.email;

        if (await isLoginBlocked(ip, email)) throw new RateLimitedError();

        const where = identifierWhere(email);
        const user = where
          ? await db.user.findFirst({
              where,
              select: { id: true, name: true, email: true, role: true, isActive: true, status: true, passwordHash: true, passwordChangedAt: true },
            })
          : null;
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

        // Урилгаа идэвхжүүлээгүй (INVITED) хэрэглэгч нэвтрэхгүй
        if (!user || !valid || !user.isActive || user.status !== "ACTIVE") {
          await recordLoginAttempt(ip, email, false);
          return null;
        }
        await recordLoginAttempt(ip, email, true);
        return { id: user.id, name: user.name, email: user.email, role: user.role, pwdAt: user.passwordChangedAt?.getTime() ?? 0 };
      },
    }),
  ],
});
