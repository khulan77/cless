import { defineConfig } from "prisma/config";

// Bun болон Next.js .env-ийг автоматаар уншдаг. Prisma CLI-г Node-оор
// ажиллуулсан тохиолдолд .env-ийг энд ачаална.
try {
  process.loadEnvFile?.(".env");
} catch {
  // .env байхгүй бол орчны хувьсагчийг шууд ашиглана.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun prisma/seed.ts",
  },
  datasource: {
    // Migration-д pooler биш шууд холболт хэрэгтэй (Supabase: session/direct, порт 5432).
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
