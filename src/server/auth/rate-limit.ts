import "server-only";
import { db } from "@/server/db";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;

export function loginKeys(ip: string, email: string) {
  return { ip: `ip:${ip}`, email: `email:${email.toLowerCase()}` };
}

/** IP эсвэл имэйлээр сүүлийн 15 минутад 5+ амжилтгүй оролдлого байвал true */
export async function isLoginBlocked(ip: string, email: string): Promise<boolean> {
  const keys = loginKeys(ip, email);
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [byIp, byEmail] = await Promise.all([
    db.loginAttempt.count({ where: { key: keys.ip, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { key: keys.email, success: false, createdAt: { gte: since } } }),
  ]);
  return byIp >= LOGIN_MAX_FAILURES || byEmail >= LOGIN_MAX_FAILURES;
}

export async function recordLoginAttempt(ip: string, email: string, success: boolean) {
  const keys = loginKeys(ip, email);
  await db.$transaction([
    db.loginAttempt.createMany({
      data: [
        { key: keys.ip, success },
        { key: keys.email, success },
      ],
    }),
    // Амжилттай нэвтэрвэл тухайн имэйлийн алдаатай оролдлогыг цэвэрлэнэ.
    ...(success ? [db.loginAttempt.deleteMany({ where: { key: keys.email, success: false } })] : []),
    // Хуучин бичлэгүүдийг цэвэрлэх (1 хоногоос өмнөх)
    db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
