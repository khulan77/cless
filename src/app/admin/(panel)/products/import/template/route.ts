/** GET /admin/products/import/template — импортын .xlsx загвар (product:write) */
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";
import { buildTemplate } from "@/server/modules/import/template";

export async function GET() {
  try {
    await requirePermission("product:write");
  } catch (e) {
    if (e instanceof UnauthorizedError || e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
  const collections = await db.collection.findMany({ select: { slug: true, name: true, kind: true } });
  const body = await buildTemplate(collections);
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cless-products-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
