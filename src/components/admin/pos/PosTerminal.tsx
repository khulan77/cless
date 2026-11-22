"use client";

import { Minus, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/admin/Dialog";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button, Card, Checkbox, Field, Input, Select, Textarea, inputClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { createCustomerAction, posCheckout, posSearchCatalog, posSearchCustomers, saveVisitAction } from "@/server/actions/pos";
import { exceedsDiscountLimit, priceSale, type DiscountInput } from "@/server/modules/sales/pricing";
import { PaymentPanel, type PaymentRow, type PaymentSale } from "./PaymentPanel";

const s = t.admin.pos;
const APPROVAL_REQUIRED = "DISCOUNT_APPROVAL_REQUIRED";
type SkinType = keyof typeof t.admin.skinTypes;

type Discount = { type: "AMOUNT" | "PERCENT"; value: number } | null;
export type CartLine = {
  key: string;
  kind: "PRODUCT" | "SERVICE";
  refId: string;
  name: string;
  detail: string;
  unitPrice: number;
  qty: number;
  staffId: string;
  discount: Discount;
  discountReason: string;
  howToUse?: string[];
};
export type PosCustomer = { id: string; name: string; phone: string; email: string | null };
type Catalog = Extract<Awaited<ReturnType<typeof posSearchCatalog>>, { ok: true }>["data"];
type Rec = { variantId: string; name: string; instructions: string };

export type PosResume = {
  sale: PaymentSale & { draft: boolean };
  payments: PaymentRow[];
  lines: CartLine[];
  customer: PosCustomer | null;
  visitId: string | null;
  saleDiscount: Discount;
  saleDiscountReason: string;
};

const toInput = (d: Discount): DiscountInput | null =>
  !d || !(d.value > 0) ? null : d.type === "AMOUNT" ? { type: "AMOUNT", value: d.value } : { type: "PERCENT", bp: Math.round(d.value * 100) };
const toField = (d: Discount) =>
  !d || !(d.value > 0) ? null : d.type === "AMOUNT" ? { type: "AMOUNT" as const, value: d.value } : { type: "PERCENT" as const, percent: d.value };

let seq = 0;
const lineKey = () => `l${Date.now().toString(36)}${seq++}`;

export function PosTerminal({
  staff,
  qpayMode,
  shiftOpen,
  canTransfer,
  maxDiscountPercent,
  vat,
  resume,
}: {
  staff: { id: string; name: string }[];
  qpayMode: "api" | "manual";
  shiftOpen: boolean;
  canTransfer: boolean;
  maxDiscountPercent: number;
  vat: { included: boolean; rateBp: number };
  resume: PosResume | null;
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [lines, setLines] = useState<CartLine[]>(resume?.sale.draft ? resume.lines : []);
  const [customer, setCustomer] = useState<PosCustomer | null>(resume?.customer ?? null);
  const [saleDiscount, setSaleDiscount] = useState<Discount>(resume?.saleDiscount ?? null);
  const [saleDiscountReason, setSaleDiscountReason] = useState(resume?.saleDiscountReason ?? "");
  const [draftSaleId, setDraftSaleId] = useState<string | null>(resume?.sale.draft ? resume.sale.id : null);
  const [visitId, setVisitId] = useState<string | null>(resume?.visitId ?? null);
  const [visitOpen, setVisitOpen] = useState(false);
  const [skinType, setSkinType] = useState<SkinType | "">("");
  const [concerns, setConcerns] = useState("");
  const [notes, setNotes] = useState("");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approval, setApproval] = useState({ email: "", password: "" });
  const [payment, setPayment] = useState<{ sale: PaymentSale; payments: PaymentRow[] } | null>(
    resume && !resume.sale.draft ? { sale: resume.sale, payments: resume.payments } : null,
  );

  const checkout = useServerAction(posCheckout);
  const visitAction = useServerAction(saveVisitAction);

  // Debounced search
  useEffect(() => {
    let stale = false;
    const id = setTimeout(async () => {
      const res = await posSearchCatalog(query);
      // Ignore out-of-order responses for an older query
      if (res.ok && !stale) setCatalog(res.data);
    }, 200);
    return () => {
      stale = true;
      clearTimeout(id);
    };
  }, [query]);

  // Shortcuts: "/" focuses search, F2 checks out
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F2") {
        e.preventDefault();
        document.getElementById("pos-checkout")?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const priced = useMemo(() => {
    if (lines.length === 0) return null;
    try {
      return priceSale({
        lines: lines.map((l) => ({ key: l.key, unitPrice: l.unitPrice, qty: l.qty, lineDiscount: toInput(l.discount) })),
        saleDiscount: toInput(saleDiscount),
        vatIncluded: vat.included,
        vatRateBp: vat.rateBp,
      });
    } catch {
      return null;
    }
  }, [lines, saleDiscount, vat]);
  const overLimit = priced ? exceedsDiscountLimit(priced, maxDiscountPercent) : false;

  const addProduct = (v: Catalog["products"][number]) => {
    setLines((ls) => {
      const existing = ls.find((l) => l.kind === "PRODUCT" && l.refId === v.id);
      if (existing) return ls.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { key: lineKey(), kind: "PRODUCT", refId: v.id, name: v.name, detail: `${v.size} · ${v.sku}`, unitPrice: v.price, qty: 1, staffId: "", discount: null, discountReason: "", howToUse: v.howToUse }];
    });
  };
  const addService = (sv: Catalog["services"][number]) => {
    setLines((ls) => [
      ...ls,
      { key: lineKey(), kind: "SERVICE", refId: sv.id, name: sv.name, detail: `${sv.durationMin}′`, unitPrice: sv.price, qty: 1, staffId: staff.length === 1 ? staff[0]!.id : "", discount: null, discountReason: "" },
    ]);
  };
  const update = (key: string, patch: Partial<CartLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addRecommendation = (v: Catalog["products"][number]) => {
    setVisitOpen(true);
    setRecs((r) => (r.some((x) => x.variantId === v.id) ? r : [...r, { variantId: v.id, name: `${v.name} · ${v.size}`, instructions: v.howToUse.map((h, i) => `${i + 1}. ${h}`).join("\n") }]));
  };

  const hasVisit = Boolean(skinType || concerns.trim() || notes.trim() || recs.length);

  const reset = () => {
    setLines([]);
    setCustomer(null);
    setSaleDiscount(null);
    setSaleDiscountReason("");
    setDraftSaleId(null);
    setVisitId(null);
    setSkinType("");
    setConcerns("");
    setNotes("");
    setRecs([]);
    setPayment(null);
    setApproval({ email: "", password: "" });
    router.replace("/admin/pos");
    router.refresh();
    searchRef.current?.focus();
  };

  const doCheckout = async (withApproval: boolean) => {
    if (lines.length === 0) return;
    let vId = visitId;
    if (hasVisit) {
      if (!customer) return toast.error(s.visitNeedsCustomer);
      const v = await visitAction.run({
        visitId: vId,
        customerId: customer.id,
        skinType: skinType || null,
        concerns: concerns.split(",").map((c) => c.trim()).filter(Boolean),
        diagnosisNotes: notes || null,
        recommendations: recs.map((r) => ({ variantId: r.variantId, instructions: r.instructions || null })),
      });
      if (!v.ok) return;
      vId = v.data.id;
      setVisitId(vId);
    }
    const res = await checkout.run(
      {
        cart: {
          saleId: draftSaleId,
          customerId: customer?.id ?? null,
          visitId: vId,
          items: lines.map((l) => ({
            kind: l.kind,
            variantId: l.kind === "PRODUCT" ? l.refId : null,
            serviceId: l.kind === "SERVICE" ? l.refId : null,
            qty: l.qty,
            staffId: l.kind === "SERVICE" ? l.staffId || null : null,
            lineDiscount: toField(l.discount),
            lineDiscountReason: l.discountReason || null,
          })),
          saleDiscount: toField(saleDiscount),
          saleDiscountReason: saleDiscountReason || null,
        },
        approval: withApproval ? approval : null,
      },
    );
    if (!res.ok) {
      if (res.code === APPROVAL_REQUIRED) setApprovalOpen(true);
      return;
    }
    setApprovalOpen(false);
    setDraftSaleId(res.data.saleId);
    setPayment({
      sale: { id: res.data.saleId, number: res.data.number, total: res.data.total, paidAmount: 0, status: res.data.status },
      payments: [],
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* ── Left: catalog ── */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/40" aria-hidden />
          <input
            ref={searchRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              // Barcode scanner: add directly on an exact SKU match
              const res = await posSearchCatalog(query);
              if (!res.ok) return;
              const exact = res.data.products.find((p) => p.id === res.data.exactSku);
              if (exact) {
                addProduct(exact);
                setQuery("");
              } else setCatalog(res.data);
            }}
            placeholder={s.search}
            aria-label={s.searchLabel}
            className={`${inputClass} h-11 w-full pl-9 text-[15px]`}
          />
          <p className="mt-1 text-[12px] text-navy/45">{s.searchHint}</p>
        </div>

        <CatalogList title={s.services} empty={!catalog?.services.length}>
          {catalog?.services.map((sv) => (
            <button key={sv.id} type="button" onClick={() => addService(sv)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-navy/[0.03]">
              <span className="min-w-0">
                <span className="block truncate text-[14px]">{sv.name}</span>
                <span className="text-[12px] text-navy/50">{sv.durationMin}′</span>
              </span>
              <span className="shrink-0 text-[14px] tabular-nums">{formatMNT(sv.price)}</span>
            </button>
          ))}
        </CatalogList>

        <CatalogList title={s.products} empty={!catalog?.products.length}>
          {catalog?.products.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-navy/[0.03]">
              <button type="button" onClick={() => addProduct(v)} disabled={v.available <= 0} className="min-w-0 flex-1 text-left disabled:opacity-50">
                <span className="block truncate text-[14px]">{v.name}</span>
                <span className="text-[12px] text-navy/50">
                  {v.size} · {v.sku} · {s.available(v.available)}
                </span>
              </button>
              <span className="shrink-0 text-[14px] tabular-nums">{formatMNT(v.price)}</span>
              <Button size="sm" variant="ghost" onClick={() => addRecommendation(v)} title={s.recommend} aria-label={`${s.recommend}: ${v.name}`}>
                <Plus className="size-3.5" />
              </Button>
            </div>
          ))}
        </CatalogList>

        <Card title={s.visit} description={s.visitHint} actions={<Button size="sm" variant="ghost" onClick={() => setVisitOpen((o) => !o)}>{visitOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}</Button>}>
          {visitOpen ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={s.skinType} htmlFor="pos-skin">
                  <Select id="pos-skin" value={skinType} onChange={(e) => setSkinType(e.target.value as SkinType | "")}>
                    <option value="">{s.chooseSkin}</option>
                    {Object.entries(t.admin.skinTypes).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={s.concerns} hint={s.concernsHint} htmlFor="pos-concerns">
                  <Input id="pos-concerns" value={concerns} onChange={(e) => setConcerns(e.target.value)} />
                </Field>
              </div>
              <Field label={s.notes} htmlFor="pos-notes">
                <Textarea id="pos-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-navy/80">{s.recommendations}</p>
                {recs.length === 0 && <p className="text-[13px] text-navy/50">{s.recommend} — ＋</p>}
                <ul className="space-y-2">
                  {recs.map((r) => (
                    <li key={r.variantId} className="rounded-md border border-line p-2.5">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[13.5px]">
                        <span>{r.name}</span>
                        <button type="button" aria-label={s.remove} onClick={() => setRecs((x) => x.filter((y) => y.variantId !== r.variantId))}>
                          <X className="size-4 text-navy/50" />
                        </button>
                      </div>
                      <Textarea
                        aria-label={s.instructions}
                        className="min-h-16 text-[13px]"
                        value={r.instructions}
                        onChange={(e) => setRecs((x) => x.map((y) => (y.variantId === r.variantId ? { ...y, instructions: e.target.value } : y)))}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            hasVisit && <Badge tone="green">{s.visit}</Badge>
          )}
        </Card>
      </div>

      {/* ── Right: cart ── */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <CustomerPicker customer={customer} onChange={setCustomer} />

        <Card title={s.cart}>
          {lines.length === 0 ? (
            <p className="text-[14px] text-navy/55">{s.emptyCart}</p>
          ) : (
            <ul className="-my-2 divide-y divide-line">
              {lines.map((l) => {
                const pl = priced?.lines.find((x) => x.key === l.key);
                return (
                  <li key={l.key} className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px]">{l.name}</p>
                        <p className="text-[12px] text-navy/50">
                          {l.detail} · {formatMNT(l.unitPrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] tabular-nums">{formatMNT(pl?.lineTotal ?? l.unitPrice * l.qty)}</p>
                        {pl && pl.lineDiscount + pl.allocatedSaleDiscount > 0 && (
                          <p className="text-[12px] text-navy/45 line-through tabular-nums">{formatMNT(pl.gross)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {l.kind === "PRODUCT" ? (
                        <div className="flex items-center rounded-md border border-line">
                          <button type="button" aria-label="-" className="px-2 py-1" onClick={() => update(l.key, { qty: Math.max(1, l.qty - 1) })}>
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-8 text-center text-[13px] tabular-nums" aria-label={s.qty}>
                            {l.qty}
                          </span>
                          <button type="button" aria-label="+" className="px-2 py-1" onClick={() => update(l.key, { qty: l.qty + 1 })}>
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <Select aria-label={s.staff} value={l.staffId} onChange={(e) => update(l.key, { staffId: e.target.value })} className="h-8 w-40 text-[13px]" aria-invalid={!l.staffId}>
                          <option value="">{s.chooseStaff}</option>
                          {staff.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </Select>
                      )}
                      <DiscountInputs value={l.discount} onChange={(d) => update(l.key, { discount: d })} label={s.lineDiscount} small />
                      <button type="button" className="ml-auto rounded p-1 text-navy/50 hover:text-red-700" aria-label={`${s.remove}: ${l.name}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {l.discount && l.discount.value > 0 && (
                      <Input value={l.discountReason} onChange={(e) => update(l.key, { discountReason: e.target.value })} placeholder={s.discountReason} aria-label={s.discountReason} className="h-8 text-[13px]" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-navy/80">{s.saleDiscount}</span>
              <DiscountInputs value={saleDiscount} onChange={setSaleDiscount} label={s.saleDiscount} />
            </div>
            {saleDiscount && saleDiscount.value > 0 && (
              <Input value={saleDiscountReason} onChange={(e) => setSaleDiscountReason(e.target.value)} placeholder={s.discountReason} aria-label={s.discountReason} />
            )}
            <dl className="space-y-1 border-t border-line pt-3 text-[14px]">
              <Row label={s.subtotal} value={priced?.subtotal ?? 0} />
              {priced && priced.lineDiscountTotal + priced.saleDiscount > 0 && <Row label={s.discounts} value={-(priced.lineDiscountTotal + priced.saleDiscount)} />}
              <div className="flex items-baseline justify-between pt-1">
                <dt className="text-[15px] font-medium">{s.total}</dt>
                <dd className="text-[24px] font-light tabular-nums">{formatMNT(priced?.total ?? 0)}</dd>
              </div>
              {priced && <p className="text-right text-[12px] text-navy/45">{s.vat(formatMNT(priced.vatTotal))}</p>}
            </dl>
            {overLimit && <p className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-800">{s.limitWarning(maxDiscountPercent)}</p>}
            <Button id="pos-checkout" className="h-11 w-full text-[15px]" disabled={lines.length === 0 || checkout.pending || visitAction.pending} onClick={() => doCheckout(false)}>
              {s.checkout} · F2
            </Button>
          </div>
        </Card>
      </div>

      <Dialog open={approvalOpen} onClose={() => setApprovalOpen(false)} title={s.approvalTitle}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void doCheckout(true);
          }}
        >
          <p className="text-[13px] text-navy/60">{s.approvalHint}</p>
          <Field label={s.email} htmlFor="appr-email" error={checkout.fieldErrors.email}>
            <Input id="appr-email" type="email" autoComplete="off" value={approval.email} onChange={(e) => setApproval((a) => ({ ...a, email: e.target.value }))} />
          </Field>
          <Field label={s.password} htmlFor="appr-pass">
            <Input id="appr-pass" type="password" autoComplete="off" value={approval.password} onChange={(e) => setApproval((a) => ({ ...a, password: e.target.value }))} />
          </Field>
          <Button type="submit" className="w-full" disabled={checkout.pending}>
            {s.approve}
          </Button>
        </form>
      </Dialog>

      <Dialog open={payment !== null} onClose={() => (payment?.sale.status === "PAID" ? reset() : setPayment(null))} title={t.admin.payment.title(payment?.sale.number ?? "")}>
        {payment && (
          <PaymentPanel
            key={payment.sale.id}
            sale={payment.sale}
            payments={payment.payments}
            qpayMode={qpayMode}
            shiftOpen={shiftOpen}
            canTransfer={canTransfer}
            onDone={reset}
            onUnlocked={() => setPayment(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-navy/70">
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatMNT(value)}</dd>
    </div>
  );
}

function CatalogList({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white">
      <h2 className="border-b border-line px-3 py-2 text-[12px] font-medium uppercase tracking-[0.4px] text-navy/55">{title}</h2>
      {empty ? <p className="px-3 py-3 text-[13px] text-navy/50">{s.noResults}</p> : <div className="max-h-72 divide-y divide-line/60 overflow-y-auto">{children}</div>}
    </section>
  );
}

function DiscountInputs({ value, onChange, label, small }: { value: Discount; onChange: (d: Discount) => void; label: string; small?: boolean }) {
  const type = value?.type ?? "AMOUNT";
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <div className={small ? "w-28" : "w-36"}>
        {type === "AMOUNT" ? (
          <MoneyInput value={value?.value ?? Number.NaN} onChange={(v) => onChange(Number.isNaN(v) ? null : { type, value: v })} aria-label={label} className={`w-full ${small ? "h-8 text-[13px]" : ""}`} />
        ) : (
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            aria-label={label}
            value={value?.value ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : { type, value: Number(e.target.value) })}
            className={`${inputClass} w-full text-right ${small ? "h-8 text-[13px]" : ""}`}
          />
        )}
      </div>
      <button
        type="button"
        className={`rounded-md border border-line px-2 text-[12px] ${small ? "h-8" : "h-9"}`}
        onClick={() => onChange(value ? { type: type === "AMOUNT" ? "PERCENT" : "AMOUNT", value: 0 } : { type: type === "AMOUNT" ? "PERCENT" : "AMOUNT", value: Number.NaN })}
        aria-label={type === "AMOUNT" ? s.discountPercent : s.discountAmount}
      >
        {type === "AMOUNT" ? s.discountAmount : s.discountPercent}
      </button>
    </div>
  );
}

function CustomerPicker({ customer, onChange }: { customer: PosCustomer | null; onChange: (c: PosCustomer | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PosCustomer[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", marketingConsent: false });
  const create = useServerAction(createCustomerAction);

  useEffect(() => {
    if (q.trim().length < 2) return;
    let stale = false;
    const id = setTimeout(async () => {
      const res = await posSearchCustomers(q);
      if (res.ok && !stale) setResults(res.data);
    }, 250);
    return () => {
      stale = true;
      clearTimeout(id);
    };
  }, [q]);

  return (
    <Card title={s.customer} actions={customer && <Button size="sm" variant="ghost" onClick={() => onChange(null)}>{s.change}</Button>}>
      {customer ? (
        <div className="flex items-center gap-3">
          <UserRound className="size-8 rounded-full bg-navy/5 p-1.5 text-navy/60" aria-hidden />
          <div className="min-w-0 text-[14px]">
            <Link href={`/admin/customers/${customer.id}`} target="_blank" className="block truncate font-medium hover:underline">
              {customer.name}
            </Link>
            <p className="text-[12px] text-navy/55">
              {customer.phone}
              {customer.email ? ` · ${customer.email}` : ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.customerSearch} aria-label={s.customerSearch} />
          {q.trim().length >= 2 && results.length > 0 && (
            <ul className="divide-y divide-line rounded-md border border-line">
              {results.map((c) => (
                <li key={c.id}>
                  <button type="button" className="w-full px-3 py-2 text-left text-[13.5px] hover:bg-navy/[0.03]" onClick={() => (onChange(c), setQ(""), setResults([]))}>
                    {c.name} <span className="text-navy/50">· {c.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-navy/50">{s.walkIn}</span>
            <Button size="sm" variant="secondary" onClick={() => (setCreating(true), setForm((f) => ({ ...f, phone: /^\d/.test(q) ? q : f.phone, name: /^\d/.test(q) ? f.name : q })))}>
              <Plus className="size-3.5" /> {s.newCustomer}
            </Button>
          </div>
        </div>
      )}
      <Dialog open={creating} onClose={() => setCreating(false)} title={s.newCustomer}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void create.run({ ...form, email: form.email || null }, {
              onSuccess: (c) => {
                onChange(c);
                setCreating(false);
                setForm({ name: "", phone: "", email: "", marketingConsent: false });
                setQ("");
              },
            });
          }}
        >
          <Field label={s.name} htmlFor="nc-name" error={create.fieldErrors.name}>
            <Input id="nc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label={s.phone} htmlFor="nc-phone" error={create.fieldErrors.phone}>
            <Input id="nc-phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label={s.email} htmlFor="nc-email" hint={s.emailHint} error={create.fieldErrors.email}>
            <Input id="nc-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Checkbox label={s.marketing} checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })} />
          <Button type="submit" className="w-full" disabled={create.pending}>
            {s.save}
          </Button>
        </form>
      </Dialog>
    </Card>
  );
}
