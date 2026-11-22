/**
 * `bun run dev:all` — Next dev сервер + background worker-ийг зэрэг ажиллуулна.
 * Аль нэг нь унавал нөгөөг нь зогсооно; Ctrl+C хоёуланг нь зогсооно.
 */
export {};

const procs = [
  { name: "next", color: "\x1b[36m", cmd: ["bun", "run", "dev"] },
  { name: "worker", color: "\x1b[35m", cmd: ["bun", "run", "worker"] },
].map((p) => {
  const child = Bun.spawn(p.cmd, { stdout: "pipe", stderr: "pipe", env: process.env });
  const prefix = `${p.color}[${p.name}]\x1b[0m `;
  for (const stream of [child.stdout, child.stderr]) {
    void (async () => {
      const decoder = new TextDecoder();
      let buf = "";
      const reader = stream.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) console.log(prefix + line);
      }
      if (buf) console.log(prefix + buf);
    })();
  }
  return { ...p, child };
});

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of procs) p.child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 8000).unref();
}
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

const first = await Promise.race(procs.map(async (p) => ({ name: p.name, code: await p.child.exited })));
if (!stopping) console.error(`[dev:all] ${first.name} зогслоо (код ${first.code}) — бусдыг зогсооно`);
stopAll(first.code ?? 1);
await Promise.all(procs.map((p) => p.child.exited));
process.exit(first.code ?? 0);
