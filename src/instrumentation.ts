/**
 * Next server асахад: орчны хувьсагч шалгана (буруу бол асахгүй).
 * Server-ийн алдаа бүрийг JSON лог-д digest (= хэрэглэгчид харагдах "Алдааны ID")-тай бичнэ.
 */
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertEnv } = await import("@/server/env");
  const { log } = await import("@/server/log");
  try {
    for (const w of assertEnv("app")) log.warn("env", { key: w.key, detail: w.message });
  } catch (e) {
    log.error("env check failed — server will not start", { error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log } = await import("@/server/log");
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  const requestId = request.headers["x-request-id"];
  log.error("request failed", {
    errorId: digest,
    requestId: Array.isArray(requestId) ? requestId[0] : requestId,
    method: request.method,
    // Query string-д токен байж болох тул зөвхөн зам
    path: request.path.split("?")[0],
    route: context.routePath,
    routeType: context.routeType,
    error: err instanceof Error ? err : String(err),
  });
};
