/** Салбарын ирцийн байршил (PROMPT 19): цэг, радиус (50–300 м), салоны Wi-Fi-ийн гадаад IP. ADMIN/MANAGER (settings:write). */
import { isIP } from "node:net";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { getCurrentBranch } from "@/server/modules/branches/service";

export const branchLocationSchema = z.object({
  latitude: z.number({ error: "Өргөрөг буруу." }).min(-90).max(90).nullable(),
  longitude: z.number({ error: "Уртраг буруу." }).min(-180).max(180).nullable(),
  geoRadiusM: z.number().int().min(50, "50–300 м").max(300, "50–300 м"),
  allowedIps: z
    .array(z.string().trim())
    .transform((xs) => [...new Set(xs.filter(Boolean))])
    .pipe(z.array(z.string().refine((ip) => isIP(ip) !== 0, "IP хаяг буруу.")).max(10)),
});

export async function getBranchLocation() {
  const b = await getCurrentBranch();
  const row = await db.branch.findUniqueOrThrow({ where: { id: b.id }, select: { id: true, name: true, latitude: true, longitude: true, geoRadiusM: true, allowedIps: true } });
  return row;
}

export async function saveBranchLocation(raw: z.input<typeof branchLocationSchema>, actorId: string) {
  const v = branchLocationSchema.parse(raw);
  const b = await getCurrentBranch();
  await db.$transaction(async (tx) => {
    const before = await tx.branch.findUniqueOrThrow({ where: { id: b.id }, select: { latitude: true, longitude: true, geoRadiusM: true, allowedIps: true } });
    await tx.branch.update({ where: { id: b.id }, data: v });
    await audit(tx, { userId: actorId, action: "branch.location", entity: "Branch", entityId: b.id, before: { ...before, allowedIps: before.allowedIps.length }, after: { ...v, allowedIps: v.allowedIps.length } });
  });
}
