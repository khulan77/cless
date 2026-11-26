import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/test-db-url";

// DB тестүүд ЗӨВХӨН локал тестийн DB-д ажиллана (brew postgresql@16 → cless_test).
// .env-ийн Supabase холболт энд хэзээ ч ашиглагдахгүй.


export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js-ийн "server-only" нь Vitest орчинд шаардлагагүй
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"], exclude: ["src/**/*.db.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts", "scripts/**/*.db.test.ts"],
          environment: "node",
          globalSetup: ["tests/db-global-setup.ts"],
          env: { DATABASE_URL: TEST_DATABASE_URL, TEST_DATABASE_URL },
          // Нэг DB-г хуваалцдаг тул файлуудыг дараалан
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
