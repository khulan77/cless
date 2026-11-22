import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ForbiddenError, UnauthorizedError, UserError } from "@/server/errors";
import type { ActionResult } from "@/lib/action-result";
import { randomUUID } from "node:crypto";
import { log } from "@/server/log";

/** zod-оор шалгаж, алдаатай бол талбарын алдаатай UserError шиднэ */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  throw new UserError("Маягтын алдааг засна уу.", fieldErrors);
}

/**
 * Server Action-ий биеийг ажиллуулж, алдааг Монгол мессежтэй үр дүн болгоно.
 * redirect()/notFound() зэрэг Next-ийн тусгай алдааг дамжуулна.
 */
export async function runAction<T>(fn: () => Promise<T>, successMessage?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message: successMessage };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof UserError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors, code: e.code };
    if (e instanceof ForbiddenError || e instanceof UnauthorizedError) {
      return { ok: false, error: e.message, status: e.status };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        const target = String((e.meta as { target?: unknown })?.target ?? "");
        return { ok: false, error: `Давхардсан утга байна${target ? ` (${target})` : ""}. Өөр утга оруулна уу.` };
      }
      if (e.code === "P2025") return { ok: false, error: "Бичлэг олдсонгүй. Хуудсаа шинэчилнэ үү." };
      if (e.code === "P2003") return { ok: false, error: "Холбоотой бичлэг байгаа тул энэ үйлдлийг хийх боломжгүй." };
    }
    // Хэрэглэгчид ID өгч, лог-д тэр ID-тай бичнэ (нууц мэдээлэл log.ts-д redact хийгдэнэ)
    const errorId = randomUUID().slice(0, 8);
    log.error("server action failed", { errorId, error: e instanceof Error ? e : String(e) });
    return { ok: false, error: `Алдаа гарлаа. Дахин оролдоно уу. (Алдааны ID: ${errorId})` };
  }
}
