/**
 * Айлчлалын зураг (A9) — зөвхөн нэвтэрсэн, эрхтэй хэрэглэгчид: ADMIN, MANAGER, тухайн үйлчлүүлэгчид
 * үйлчилсэн STAFF. Файл хувийн хавтаснаас; хөтөч/прокси кэшлэхгүй.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { canSeePhotosOf } from "@/server/modules/visits/photos";
import { privateStorage } from "@/server/storage/private";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/media/visit/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const { id } = await ctx.params;
  const photo = await db.visitPhoto.findUnique({ where: { id }, select: { customerId: true, storageKey: true } });
  // Байхгүй ба эрхгүй хоёрыг ялгахгүй (зураг байгаа эсэхийг задруулахгүй)
  if (!photo || !(await canSeePhotosOf(user, photo.customerId))) return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  const data = await privateStorage.read(photo.storageKey);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  return new NextResponse(new Uint8Array(data), { headers: { ...NO_STORE, "Content-Type": "image/webp", "Content-Disposition": "inline" } });
}
