/**
 * Outbox worker-ийг нэг файл болгон bundle хийнэ (Docker image-д node_modules хэрэггүй).
 *   bun scripts/build-worker.ts  →  dist/worker/index.js
 * Ажиллуулах: bun dist/worker/index.js
 *
 * src/worker/preload.ts-тэй ижил: `server-only`-г хоосон модуль болгоно.
 */
export {};

const result = await Bun.build({
  entrypoints: ["./src/worker/index.ts"],
  outdir: "./dist/worker",
  target: "bun",
  minify: { syntax: true, whitespace: true },
  sourcemap: "linked",
  // pg-ийн native горим ашиглагдахгүй
  external: ["pg-native"],
  plugins: [
    {
      name: "server-only-stub",
      setup(build) {
        build.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "stub" }));
        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export {};", loader: "js" }));
      },
    },
  ],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
for (const o of result.outputs) console.log(`${o.path} (${(o.size / 1024).toFixed(0)} KB)`);
