import "server-only";
import { db } from "@/server/db";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;

export function loginKeys(ip: string, email: string) {
  return { ip: `ip:${ip}`, email: `email:${email.toLowerCase()}` };
}

/**
 * Түгжээ: 15 минутын дотор 5 амжилтгүй оролдлого (IP эсвэл имэйлээр) → 5 дахь оролдлогоос хойш 15 минут.
 * Түгжигдсэн үед оролдлого бичигдэхгүй, зөв нууц үгээр ч нэвтрэхгүй.
 */
export function lockedUntil(failures: Date[], now = new Date()): Date | null {
  const recent = [...failures].sort((a, b) => b.getTime() - a.getTime()).slice(0, LOGIN_MAX_FAILURES);
  if (recent.length < LOGIN_MAX_FAILURES) return null;
  const newest = recent[0]!.getTime();
  const oldest = recent[recent.length - 1]!.getTime();
  if (newest - oldest > LOGIN_WINDOW_MS) return null;
  const until = new Date(newest + LOGIN_WINDOW_MS);
  return until > now ? until : null;
}

export async function isLoginBlocked(ip: string, email: string, now = new Date()): Promise<boolean> {
  const keys = loginKeys(ip, email);
  const since = new Date(now.getTime() - 2 * LOGIN_WINDOW_MS);
  const recent = (key: string) =>
    db.loginAttempt.findMany({ where: { key, success: false, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: LOGIN_MAX_FAILURES, select: { createdAt: true } });
  const [byIp, byEmail] = await Promise.all([recent(keys.ip), recent(keys.email)]);
  return Boolean(lockedUntil(byIp.map((r) => r.createdAt), now) || lockedUntil(byEmail.map((r) => r.createdAt), now));
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
