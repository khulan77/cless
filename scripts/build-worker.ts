/**
 * Outbox worker-ийг нэг файл болгон bundle хийнэ (Docker image-д node_modules хэрэггүй).
 *   bun scripts/build-worker.ts  →  dist/worker/index.js
 * Ажиллуулах: bun dist/worker/index.js
 *
 * src/worker/preload.ts-тэй ижил: `server-only`-г хоосон модуль болгоно.
 */
import path from "node:path";

// Туршилтад өөр entry-г ижил тохиргоогоор bundle хийх: bun scripts/build-worker.ts <entry> <outdir>
const [entry = "./src/worker/index.ts", outdir = "./dist/worker"] = process.argv.slice(2);

const result = await Bun.build({
  entrypoints: [entry],
  outdir,
  target: "bun",
  minify: { syntax: true, whitespace: true },
  sourcemap: "linked",
  // pg-ийн native горим ашиглагдахгүй
  // next/server: outbox/drain.ts-ийн after() — worker-т хэрэггүй (request-гүй), импорт алдааг чимээгүй алгасна
  external: ["pg-native", "next/server"],
  plugins: [
    {
      name: "server-only-stub",
      setup(build) {
        build.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "stub" }));
        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export {};", loader: "js" }));
      },
    },
    {
      // Bun 1.3.11-ийн bug: react-dom/server → server.bun.js → cjs/react-dom-server.bun.production.js
      // нь parse/load үед унадаг (bundle: "Cannot find scope for the label", source: "Expected CommonJS
      // module to have a function wrapper") → production-д React Email render ажиллахгүй.
      // Тойруу зам: development build (ижил API). server.node.js-ийг туршсан — мөн унадаг.
      // Bun шинэчлэгдвэл: scripts/build-worker.ts-ийн probe-оор шалгаад энэ plugin-ийг хасна.
      name: "react-dom-server-bun-workaround",
      setup(build) {
        const devBuild = path.resolve("node_modules/react-dom/cjs/react-dom-server.bun.development.js");
        build.onResolve({ filter: /^react-dom\/server$/ }, () => ({ path: devBuild }));
      },
    },
  ],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
for (const o of result.outputs) console.log(`${o.path} (${(o.size / 1024).toFixed(0)} KB)`);
