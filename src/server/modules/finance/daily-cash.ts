/**
 * "Өдрийн касс" (PROMPT 20) — кассын ээлжийн оронд: огноо × бүртгэсэн хүн × төлбөрийн хэлбэр, буцаалт хассан.
 *  - Орсон: амжилттай төлбөр (Payment.paidAt, УБ өдөр), бүртгэсэн = төлбөр авсан хэрэглэгч (createdById).
 *  - Буцаалт: дууссан (Refund.completedAt), бүртгэсэн = хүсэлт гаргасан (requestedById), хэлбэрээр хасна.
 * 2 менежер зэрэг ажиллахад тус тусдаа мөр гарна. Нягтлангийн "Мөнгөн гүйлгээ" ижил эх сурвалжаас (Payment, Refund).
 */
import { Prisma } from "@/generated/prisma/client";
import { payLabel } from "@/lib/pay-label";
import { db } from "@/server/db";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { rangeBounds, type ReportRange } from "@/server/modules/reports/definitions";
import { getQPaySettings } from "@/server/modules/settings/pos-settings";

/** PROMPT 29: QPay — дансаар тусдаа багана (QPAY_A «QPay — Компанийн данс», QPAY_B «QPay — Захирлын данс») */
export const CASH_KEYS = ["CASH", "CARD", "QPAY_A", "QPAY_B", "TRANSFER"] as const;
export type CashKey = (typeof CASH_KEYS)[number];

type Raw = { day: string; userId: string; method: CashKey; paid: number; refunded: number; count: number };
export type DailyCashRow = { day: string; userId: string; name: string; byMethod: Partial<Record<CashKey, number>>; refunds: number; net: number; payments: number };

/** QPay → QPAY_<данс> (хуучин мөр — A). Буцаалт — тухайн борлуулалтын QPay төлбөрийн данс. */
const PAY_KEY = Prisma.sql`CASE WHEN pm."method"::text = 'QPAY' THEN 'QPAY_' || COALESCE(pm."qpayAccount"::text, 'A') ELSE pm."method"::text END`;
const REFUND_KEY = Prisma.sql`CASE WHEN rf."method"::text = 'QPAY' THEN 'QPAY_' || COALESCE((
    SELECT p2."qpayAccount"::text FROM "Payment" p2
    WHERE p2."saleId" = rf."saleId" AND p2."method"::text = 'QPAY' AND p2."status"::text = 'SUCCEEDED'
    ORDER BY p2."createdAt" LIMIT 1), 'A') ELSE rf."method"::text END`;

export async function dailyCash(range: ReportRange): Promise<{
  columns: { key: CashKey; label: string }[];
  rows: DailyCashRow[];
  totals: Partial<Record<CashKey, number>> & { net: number; refunds: number };
}> {
  const branch = await getCurrentBranch();
  const { start, end } = rangeBounds(range);
  const qpay = await getQPaySettings();
  const raw = await db.$queryRaw<Raw[]>(Prisma.sql`
    WITH p AS (
      SELECT to_char((pm."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day,
        pm."createdById" AS "userId", ${PAY_KEY} AS "method", SUM(pm."amount")::int AS paid, 0 AS refunded, COUNT(*)::int AS count
      FROM "Payment" pm JOIN "Sale" s ON s."id" = pm."saleId"
      WHERE pm."status"::text = 'SUCCEEDED' AND pm."paidAt" >= ${start} AND pm."paidAt" < ${end} AND s."branchId" = ${branch.id}
      GROUP BY 1, 2, 3
    ), r AS (
      SELECT to_char((rf."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day,
        rf."requestedById" AS "userId", ${REFUND_KEY} AS "method", 0 AS paid, SUM(rf."amount")::int AS refunded, 0 AS count
      FROM "Refund" rf JOIN "Sale" s ON s."id" = rf."saleId"
      WHERE rf."status"::text = 'COMPLETED' AND rf."completedAt" >= ${start} AND rf."completedAt" < ${end} AND s."branchId" = ${branch.id}
      GROUP BY 1, 2, 3
    )
    SELECT day, "userId", "method", SUM(paid)::int AS paid, SUM(refunded)::int AS refunded, SUM(count)::int AS count
    FROM (SELECT * FROM p UNION ALL SELECT * FROM r) x GROUP BY 1, 2, 3 ORDER BY 1 DESC
  `);
  const users = await db.user.findMany({ where: { id: { in: [...new Set(raw.map((r) => r.userId))] } }, select: { id: true, name: true } });
  const map = new Map<string, DailyCashRow>();
  const totals: Partial<Record<CashKey, number>> & { net: number; refunds: number } = { net: 0, refunds: 0 };
  for (const r of raw) {
    const k = `${r.day}|${r.userId}`;
    const row = map.get(k) ?? { day: r.day, userId: r.userId, name: users.find((u) => u.id === r.userId)?.name ?? "—", byMethod: {}, refunds: 0, net: 0, payments: 0 };
    const net = r.paid - r.refunded;
    row.byMethod[r.method] = (row.byMethod[r.method] ?? 0) + net;
    row.refunds += r.refunded;
    row.net += net;
    row.payments += r.count;
    totals[r.method] = (totals[r.method] ?? 0) + net;
    totals.net += net;
    totals.refunds += r.refunded;
    map.set(k, row);
  }
  const labels = { A: qpay.accounts.A.label, B: qpay.accounts.B.label };
  // B багана — идэвхтэй эсвэл тухайн хугацаанд гүйлгээтэй үед
  const columns = CASH_KEYS.filter((k) => k !== "QPAY_B" || qpay.accounts.B.enabled || totals.QPAY_B !== undefined).map((key) => ({
    key,
    label: key.startsWith("QPAY_") ? payLabel("QPAY", key === "QPAY_B" ? "B" : "A", labels) : payLabel(key, null, null),
  }));
  return { columns, rows: [...map.values()].sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name)), totals };
}
