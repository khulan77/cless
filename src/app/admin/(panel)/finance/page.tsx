import Link from "next/link";
import { PeriodPicker } from "@/components/admin/finance/PeriodPicker";
import { Card, PageHeader, btnClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { requireFinancePage } from "@/server/modules/finance/access";
import { balanceSheet, cashFlow, compare, financeRange, previousFinanceRange, profitAndLoss, vatReport } from "@/server/modules/finance/reports";

export const metadata = { title: "Санхүүгийн тайлан" };
export const instant = false;

type SP = Promise<Record<string, string | string[] | undefined>>;
const TABS = [
  ["pl", "Орлого-зарлага"],
  ["cash", "Мөнгөн гүйлгээ"],
  ["balance", "Баланс"],
  ["vat", "НӨАТ"],
] as const;
type Tab = (typeof TABS)[number][0];
const PAY = t.admin.payMethod as Record<string, string>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

const money = (n: number | null | undefined) => (n === null || n === undefined ? "—" : formatMNT(n));
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "▲" : n < 0 ? "▼" : ""} ${Math.abs(n)}%`);

function Row({ label, value, vat, strong, indent, muted }: { label: string; value: number | null; vat?: number | null; strong?: boolean; indent?: boolean; muted?: boolean }) {
  return (
    <tr className={`border-b border-hairline ${strong ? "font-semibold" : ""} ${muted ? "text-ink-soft" : ""}`}>
      <td className={`py-2.5 pr-4 ${indent ? "pl-6" : ""}`}>{label}</td>
      <td className="py-2.5 text-right tabular-nums">{money(value)}</td>
      {vat !== undefined && <td className="py-2.5 pl-4 text-right tabular-nums text-ink-soft">{vat ? money(vat) : ""}</td>}
    </tr>
  );
}

export default async function FinancePage({ searchParams }: { searchParams: SP }) {
  await requireFinancePage("finance");
  const sp = await searchParams;
  const tab: Tab = TABS.find(([k]) => k === one(sp.tab))?.[0] ?? "pl";
  const { period, range } = financeRange({ period: one(sp.period), date: one(sp.date), from: one(sp.from), to: one(sp.to) });
  const qs = new URLSearchParams({ period, from: range.from, to: range.to, date: range.to }).toString();
  const tabHref = (k: Tab) => `/admin/finance?${qs}&tab=${k}`;

  return (
    <>
      <PageHeader
        eyebrow="Санхүү"
        title="Санхүүгийн тайлан"
        description="Бүх дүн ₮; орлого, зардал НӨАТ-гүй цэвэр дүнгээр, НӨАТ тусдаа баганад."
        actions={
          <a href={`/api/admin/finance/export.xlsx?${qs}`} className={btnClass("primary")}>
            Бүх системийн тайлан (XLSX)
          </a>
        }
      />
      <PeriodPicker base="/admin/finance" period={period} range={range} extra={{ tab }} />
      <nav aria-label="Тайлан" className="mb-6 flex flex-wrap gap-1 border-b border-hairline">
        {TABS.map(([k, label]) => (
          <Link key={k} href={tabHref(k)} aria-current={tab === k ? "page" : undefined} className={`-mb-px border-b-2 px-3 py-2 text-[14px] ${tab === k ? "border-navy font-medium" : "border-transparent text-ink-soft hover:text-navy"}`}>
            {label}
          </Link>
        ))}
      </nav>
      {tab === "pl" && <PL period={period} range={range} />}
      {tab === "cash" && <Cash range={range} />}
      {tab === "balance" && <BalanceView asOf={range.to} />}
      {tab === "vat" && <Vat range={range} />}
    </>
  );
}

async function PL({ period, range }: { period: Parameters<typeof previousFinanceRange>[0]; range: { from: string; to: string } }) {
  const prevRange = previousFinanceRange(period, range);
  const [pl, prev] = await Promise.all([profitAndLoss(range), profitAndLoss(prevRange)]);
  const c = compare(pl, prev);
  const R = pl.revenue;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card title="Орлого-зарлагын тайлан">
        <table className="w-full text-[14px]">
          <thead className="text-[13px] text-ink-soft">
            <tr className="border-b border-hairline">
              <th className="py-2 text-left font-medium" />
              <th className="py-2 text-right font-medium">НӨАТ-гүй</th>
              <th className="py-2 pl-4 text-right font-medium">НӨАТ</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Үйлчилгээ — үнийн дүн" value={R.service.gross} vat={null} muted />
            <Row label="Хөнгөлөлт" value={-R.service.discount} vat={null} indent muted />
            <Row label="Үйлчилгээний орлого" value={R.service.net} vat={R.service.vat} />
            <Row label="Бүтээгдэхүүн — үнийн дүн" value={R.product.gross} vat={null} muted />
            <Row label="Хөнгөлөлт" value={-R.product.discount} vat={null} indent muted />
            <Row label="Бүтээгдэхүүний орлого" value={R.product.net} vat={R.product.vat} />
            <Row label="Нийт цэвэр орлого" value={R.total.net} vat={R.total.vat} strong />
            <Row label="Борлуулсан бүтээгдэхүүний өртөг" value={-pl.cogs} vat={null} />
            <Row label="Нийт ашиг" value={pl.grossProfit} vat={null} strong />
            {pl.expenses.map((e) => (
              <Row key={e.code} label={`${e.code} · ${e.name}`} value={e.info ? e.net : -e.net} vat={e.vat || null} indent muted={e.info} />
            ))}
            <Row label="Нийт зардал" value={-pl.expensesTotal} vat={null} strong />
            <Row label="Цэвэр ашиг" value={pl.netProfit} vat={null} strong />
          </tbody>
        </table>
        <p className="mt-3 text-[13px] text-ink-soft">Буцаалтыг зарсан хугацаандаа хасна. ХХОАТ ажилтны цалингаас суутгагддаг тул цалингийн зардалд багтсан — нийлбэрт дахин нэмээгүй.</p>
      </Card>
      <Card title="Өмнөх үетэй" description={`${prevRange.from} — ${prevRange.to}`}>
        <dl className="space-y-3 text-[14px]">
          {(
            [
              ["Цэвэр орлого", prev.revenue.total.net, c.revenue],
              ["Нийт ашиг", prev.grossProfit, c.grossProfit],
              ["Зардал", prev.expensesTotal, c.expenses],
              ["Цэвэр ашиг", prev.netProfit, c.netProfit],
            ] as const
          ).map(([l, v, d]) => (
            <div key={l} className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-soft">{l}</dt>
              <dd className="text-right tabular-nums">
                {money(v)} <span className={`ml-2 text-[13px] ${d !== null && d < 0 ? "text-err" : "text-ok"}`}>{pct(d)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

async function Cash({ range }: { range: { from: string; to: string } }) {
  const cf = await cashFlow(range);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Мөнгөн гүйлгээ">
        {cf.openingNote && <p className="mb-3 rounded-xl bg-warn-bg px-3 py-2 text-[13px] text-warn">{cf.openingNote}</p>}
        <table className="w-full text-[14px]">
          <thead className="text-[13px] text-ink-soft">
            <tr className="border-b border-hairline">
              <th className="py-2 text-left font-medium" />
              <th className="py-2 text-right font-medium">Бэлэн</th>
              <th className="py-2 pl-4 text-right font-medium">Данс</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-hairline font-semibold">
              <td className="py-2.5">Эхний үлдэгдэл</td>
              <td className="py-2.5 text-right tabular-nums">{money(cf.opening?.cash)}</td>
              <td className="py-2.5 pl-4 text-right tabular-nums">{money(cf.opening?.bank)}</td>
            </tr>
            {cf.inflows.map((i) => (
              <tr key={i.method} className="border-b border-hairline">
                <td className="py-2.5 pl-6">+ {PAY[i.method] ?? i.method}</td>
                <td className="py-2.5 text-right tabular-nums">{i.method === "CASH" ? money(i.amount) : ""}</td>
                <td className="py-2.5 pl-4 text-right tabular-nums">{i.method === "CASH" ? "" : money(i.amount)}</td>
              </tr>
            ))}
            {cf.outflows.map((o) => (
              <tr key={o.label} className="border-b border-hairline">
                <td className="py-2.5 pl-6">− {o.label}</td>
                <td className="py-2.5 text-right tabular-nums">{o.cash ? money(-o.cash) : ""}</td>
                <td className="py-2.5 pl-4 text-right tabular-nums">{o.bank ? money(-o.bank) : ""}</td>
              </tr>
            ))}
            <tr className="border-b border-hairline">
              <td className="py-2.5">Цэвэр өөрчлөлт</td>
              <td className="py-2.5 text-right tabular-nums">{money(cf.totals.netCash)}</td>
              <td className="py-2.5 pl-4 text-right tabular-nums">{money(cf.totals.netBank)}</td>
            </tr>
            <tr className="font-semibold">
              <td className="py-2.5">Эцсийн үлдэгдэл</td>
              <td className="py-2.5 text-right tabular-nums">{money(cf.closing?.cash)}</td>
              <td className="py-2.5 pl-4 text-right tabular-nums">{money(cf.closing?.bank)}</td>
            </tr>
          </tbody>
        </table>
        {cf.nonCash.length > 0 && (
          <p className="mt-3 text-[13px] text-ink-soft">
            Мөнгө биш (үлдэгдэлд ороогүй): {cf.nonCash.map((n) => `${PAY[n.method] ?? n.method} ${money(n.amount)}`).join(", ")}
          </p>
        )}
        <p className="mt-2 text-[13px] text-ink-soft">Кассаас гаргасан зардлыг «Зардал»-д бэлэнээр бүртгэсэн бол кассын PAY_OUT-д давхар бүү бүртгэ.</p>
      </Card>
      <Card title="Кассын ээлж">
        {cf.shifts.length === 0 ? (
          <p className="text-[14px] text-ink-soft">Энэ хугацаанд хаагдсан ээлж алга.</p>
        ) : (
          <table className="w-full text-[14px]">
            <thead className="text-[13px] text-ink-soft">
              <tr className="border-b border-hairline">
                <th className="py-2 text-left font-medium">Хаасан</th>
                <th className="py-2 text-right font-medium">Хүлээгдэж буй</th>
                <th className="py-2 text-right font-medium">Тоолсон</th>
                <th className="py-2 text-right font-medium">Зөрүү</th>
              </tr>
            </thead>
            <tbody>
              {cf.shifts.map((s) => (
                <tr key={s.id} className="border-b border-hairline">
                  <td className="py-2 tabular-nums">{s.closedAt?.toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar", dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="py-2 text-right tabular-nums">{money(s.expected)}</td>
                  <td className="py-2 text-right tabular-nums">{money(s.counted)}</td>
                  <td className={`py-2 text-right tabular-nums ${s.difference ? "text-err" : ""}`}>{money(s.difference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

async function BalanceView({ asOf }: { asOf: string }) {
  const b = await balanceSheet(asOf);
  const list = (rows: { label: string; amount: number | null; note?: string }[]) =>
    rows.map((r) => (
      <tr key={r.label} className="border-b border-hairline">
        <td className="py-2.5 pr-4">
          {r.label}
          {r.note && <span className="block text-[12px] text-ink-soft">{r.note}</span>}
        </td>
        <td className="py-2.5 text-right tabular-nums">{money(r.amount)}</td>
      </tr>
    ));
  return (
    <Card title="Удирдлагын баланс (хялбаршуулсан)" description={`${asOf}-ны байдлаар. Давхар бичилтийн баланс биш — нягтлангийн программд шилжүүлэх лавлагаа (XLSX).`}>
      <div className="grid gap-8 lg:grid-cols-2">
        <table className="w-full text-[14px]">
          <tbody>
            <tr className="border-b border-hairline font-semibold"><td className="py-2.5" colSpan={2}>Хөрөнгө</td></tr>
            {list(b.assets)}
            <tr className="font-semibold"><td className="py-2.5">Нийт хөрөнгө</td><td className="py-2.5 text-right tabular-nums">{money(b.totalAssets)}</td></tr>
          </tbody>
        </table>
        <table className="w-full text-[14px]">
          <tbody>
            <tr className="border-b border-hairline font-semibold"><td className="py-2.5" colSpan={2}>Өр төлбөр</td></tr>
            {list(b.liabilities)}
            <tr className="border-b border-hairline font-semibold"><td className="py-2.5">Нийт өр төлбөр</td><td className="py-2.5 text-right tabular-nums">{money(b.totalLiabilities)}</td></tr>
            <tr className="font-semibold"><td className="py-2.5">Өмч (хөрөнгө − өр)</td><td className="py-2.5 text-right tabular-nums">{money(b.equity)}</td></tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function Vat({ range }: { range: { from: string; to: string } }) {
  const rows = await vatReport(range);
  return (
    <Card title="НӨАТ-ын тайлан" description="Үнэ НӨАТ-тэй: цэвэр = дүн / 1.1, НӨАТ = дүн − цэвэр (мөр бүрээр бөөрөнхийлсөн). 400 000₮ → 363 636₮ + 36 364₮.">
      <table className="w-full text-[14px]">
        <thead className="text-[13px] text-ink-soft">
          <tr className="border-b border-hairline">
            <th className="py-2 text-left font-medium">Сар</th>
            <th className="py-2 text-right font-medium">Борлуулалт (НӨАТ-гүй)</th>
            <th className="py-2 text-right font-medium">Борлуулалтын НӨАТ</th>
            <th className="py-2 text-right font-medium">Зардлын НӨАТ</th>
            <th className="py-2 text-right font-medium">Төлөх НӨАТ</th>
            <th className="py-2 text-right font-medium" title="eBarimt-д амжилттай илгээгдсэн борлуулалтын НӨАТ — тулгалт">eBarimt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className="border-b border-hairline">
              <td className="py-2.5 tabular-nums">{r.month}</td>
              <td className="py-2.5 text-right tabular-nums">{money(r.salesNet)}</td>
              <td className="py-2.5 text-right tabular-nums">{money(r.salesVat)}</td>
              <td className="py-2.5 text-right tabular-nums">{money(r.expenseVat)}</td>
              <td className="py-2.5 text-right font-semibold tabular-nums">{money(r.payable)}</td>
              <td className={`py-2.5 text-right tabular-nums ${r.ebarimtVat !== r.salesVat ? "text-warn" : "text-ink-soft"}`}>{money(r.ebarimtVat)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[13px] text-ink-soft">eBarimt багана: PosAPI 3.0-оос буцсан дүнгээр солигдоно. Зөрүүтэй бол шар өнгөөр.</p>
    </Card>
  );
}
