import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/server/db";
import { clientIp, isLoginBlocked, recordLoginAttempt } from "@/server/auth/rate-limit";

export class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
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
        const { email, password } = parsed.data;
        const ip = clientIp(request.headers);

        if (await isLoginBlocked(ip, email)) throw new RateLimitedError();

        const user = await db.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, role: true, isActive: true, passwordHash: true, passwordChangedAt: true },
        });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !valid || !user.isActive) {
          await recordLoginAttempt(ip, email, false);
          return null;
        }
        await recordLoginAttempt(ip, email, true);
        return { id: user.id, name: user.name, email: user.email, role: user.role, pwdAt: user.passwordChangedAt?.getTime() ?? 0 };
      },
    }),
  ],
});
