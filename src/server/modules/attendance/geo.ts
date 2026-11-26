/**
 * Байршлаар ирц (PROMPT 19) — цэвэр тооцоо (DB-гүй, unit test).
 * Зөвшөөрөх нөхцөл: зай ≤ радиус + min(нарийвчлал, 50 м). Нарийвчлал > 150 м эсвэл IP таарахгүй — бүртгэнэ, flagged.
 */
export const ACCURACY_SLACK_MAX = 50;
export const ACCURACY_FLAG = 150;

/** Хоёр цэгийн хоорондох зай (м), haversine */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type GeoBranch = { id: string; latitude: number | null; longitude: number | null; geoRadiusM: number; allowedIps: string[] };
export type GeoInput = { lat: number; lng: number; accuracyM: number };

export type GeoVerdict =
  | { ok: true; branchId: string; distanceM: number; flagged: boolean; reasons: ("accuracy" | "ip")[] }
  | { ok: false; reason: "no-branch-location" }
  | { ok: false; reason: "too-far"; distanceM: number };

/** Хамгийн ойр салбарыг олж шалгана. ip — хүсэлтийн IP (allowedIps тохируулсан бол харьцуулна). */
export function evaluateGeo(branches: GeoBranch[], pos: GeoInput, ip: string | null): GeoVerdict {
  const located = branches.filter((b): b is GeoBranch & { latitude: number; longitude: number } => b.latitude !== null && b.longitude !== null);
  if (located.length === 0) return { ok: false, reason: "no-branch-location" };
  const nearest = located
    .map((b) => ({ b, d: haversineM(pos.lat, pos.lng, b.latitude, b.longitude) }))
    .sort((x, y) => x.d - y.d)[0]!;
  const allowed = nearest.b.geoRadiusM + Math.min(Math.max(0, pos.accuracyM), ACCURACY_SLACK_MAX);
  const distanceM = Math.round(nearest.d);
  if (nearest.d > allowed) return { ok: false, reason: "too-far", distanceM };
  const reasons: ("accuracy" | "ip")[] = [];
  if (pos.accuracyM > ACCURACY_FLAG) reasons.push("accuracy");
  if (nearest.b.allowedIps.length > 0 && (!ip || !nearest.b.allowedIps.includes(ip))) reasons.push("ip");
  return { ok: true, branchId: nearest.b.id, distanceM, flagged: reasons.length > 0, reasons };
}
