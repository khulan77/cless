/**
 * Анхны (эсвэл нэмэлт) ADMIN хэрэглэгч үүсгэнэ. Production-д seed ажиллахгүй тул үүнийг ашиглана.
 *
 *   bun scripts/create-admin.ts --email admin@cless.mn --name "Админ"
 *   (сервер дээр) dc run --rm tools bun scripts/create-admin.ts --email … --name …
 *
 * Нууц үгийг ADMIN_PASSWORD орчны хувьсагчаас, эсвэл интерактив асууна (shell history-д үлдэхгүй).
 * Имэйл аль хэдийн байвал — алдаа (нууц үг сэргээхийг админ хэсгээс хийнэ). `--reset` өгвөл
 * тухайн хэрэглэгчийн нууц үгийг шинэчилж, ADMIN болгож, идэвхжүүлнэ.
 */
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseArgs } from "node:util";
import { z } from "zod";
import { PrismaClient } from "../src/generated/prisma/client";
import { passwordSchema } from "../src/lib/validation/user";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    phone: { type: "string" },
    reset: { type: "boolean", default: false },
  },
});

const fail = (msg: string): never => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const email = z.email().safeParse(values.email?.trim().toLowerCase());
if (!email.success) fail("--email буруу эсвэл өгөөгүй байна.");
const name = values.name?.trim() || (values.reset ? undefined : fail("--name өгнө үү."));

async function readPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!process.stdin.isTTY) fail("ADMIN_PASSWORD тохируулна уу (интерактив бус горим).");
  const ask = (q: string) => {
    process.stdout.write(q);
    process.stdin.setRawMode?.(true);
    return new Promise<string>((resolve) => {
      let buf = "";
      const onData = (d: Buffer) => {
        for (const ch of d.toString("utf8")) {
          if (ch === "\r" || ch === "\n") {
            process.stdin.off("data", onData);
            process.stdin.setRawMode?.(false);
            process.stdin.pause();
            process.stdout.write("\n");
            return resolve(buf);
          }
          if (ch === "\u0003") process.exit(130);
          if (ch === "\u007f") buf = buf.slice(0, -1);
          else buf += ch;
        }
      };
      process.stdin.resume();
      process.stdin.on("data", onData);
    });
  };
  const p1 = await ask("Нууц үг (8+ тэмдэгт): ");
  const p2 = await ask("Дахин оруулна уу: ");
  if (p1 !== p2) fail("Нууц үг таарахгүй байна.");
  return p1;
}

const password = passwordSchema.safeParse(await readPassword());
if (!password.success) fail(password.error!.issues[0]!.message);

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) fail("DATABASE_URL тохируулагдаагүй байна.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString! }) });

try {
  const passwordHash = await bcrypt.hash(password.data!, 12);
  const existing = await db.user.findUnique({ where: { email: email.data! } });

  if (existing && !values.reset) fail(`${email.data} аль хэдийн бүртгэлтэй. Нууц үг шинэчлэх бол --reset нэмнэ үү.`);

  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: { passwordHash, role: "ADMIN", isActive: true, ...(name && { name }) },
      })
    : await db.user.create({
        data: { email: email.data!, name: name!, phone: values.phone?.trim() || null, passwordHash, role: "ADMIN" },
      });

  // Нэвтрэх түгжээг арилгана (админ нууц үг шинэчлэхтэй ижил)
  await db.loginAttempt.deleteMany({ where: { key: `email:${user.email}` } });
  await db.auditLog.create({
    data: {
      userId: null,
      action: existing ? "user.cli-reset-admin" : "user.cli-create-admin",
      entity: "User",
      entityId: user.id,
      after: { email: user.email, role: user.role },
    },
  });
  console.log(`✓ ${existing ? "Шинэчлэгдлээ" : "Үүслээ"}: ${user.email} (ADMIN)`);
} finally {
  await db.$disconnect();
}
