import { warnIfProdEnv } from "./prod-env-warning";

/** vitest globalSetup (unit) — prod түлхүүрийн анхааруулга */
export default function setup() {
  warnIfProdEnv("bun test");
}
