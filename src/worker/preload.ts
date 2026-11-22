/**
 * The worker runs outside Next: `server-only` throws on import without the
 * "react-server" condition, and that condition breaks react-dom/server (React Email).
 * Load `server-only` as an empty module instead.
 */
import { plugin } from "bun";

plugin({
  name: "server-only-stub",
  setup(build) {
    build.onLoad({ filter: /[\\/]server-only[\\/]index\.js$/ }, () => ({ contents: "export {};", loader: "js" }));
  },
});
