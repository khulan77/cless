"use client";

import { Check, FileText, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Dialog } from "@/components/admin/Dialog";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { useServerAction } from "@/components/admin/use-action";
import { Badge, Button, Card, Field, Input, Select, Textarea, inputClass } from "@/components/admin/ui";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import {
  posCheckout,
  posDiscardDraft,
  posNewDraft,
  posSaveDraft,
  posSearchCatalog,
  saveVisitAction,
} from "@/server/actions/pos";
import { apptOpenPos } from "@/server/actions/appointments";
import type { DraftData } from "@/server/modules/sales/drafts";
import { exceedsDiscountLimit, priceSale, type DiscountInput } from "@/server/modules/sales/pricing";
import { CustomerPicker, type PickedCustomer } from "@/components/admin/customers/CustomerPicker";
import { PaymentPanel, type PaymentRow, type PaymentSale } from "./PaymentPanel";

const s = t.admin.pos;
const APPROVAL_REQUIRED = "DISCOUNT_APPROVAL_REQUIRED";
const DRAFT_LOCKED = "DRAFT_LOCKED";
const AUTOSAVE_MS = 500;
type SkinType = keyof typeof t.admin.skinTypes;

type Discount = { type: "AMOUNT" | "PERCENT"; value: number } | null;
export type CartLine = DraftData["lines"][number];
export type PosCustomer = PickedCustomer;
type Catalog = Extract<Awaited<ReturnType<typeof posSearchCatalog>>, { ok: true }>["data"];
type Rec = DraftData["visit"]["recs"][number];

export type PosInitial = {
  /** null = unsaved new cart (the first change creates the draft) */
  saleId: string | null;
  data: DraftData;
  /** Locked sale awaiting payment */
  payment: { sale: PaymentSale; payments: PaymentRow[] } | null;
};
export type PosDraftSummary = { id: string; number: string | null; customerName: string | null; lines: number; subtotal: number; updatedAt: string };

const toInput = (d: Discount): DiscountInput | null =>
  !d || !(d.value > 0) ? null : d.type === "AMOUNT" ? { type: "AMOUNT", value: d.value } : { type: "PERCENT", bp: Math.round(d.value * 100) };
const toField = (d: Discount) =>
  !d || !(d.value > 0) ? null : d.type === "AMOUNT" ? { type: "AMOUNT" as const, value: d.value } : { type: "PERCENT" as const, percent: d.value };
/** NaN (empty input) would become null in JSON — drop it before saving */
const cleanDiscount = (d: Discount): Discount => (d && Number.isFinite(d.value) ? d : null);

let seq = 0;
const lineKey = () => `l${Date.now().toString(36)}${seq++}`;

export function PosTerminal({
  staff,
  qpayMode,
  shiftOpen,
  canTransfer,
  maxDiscountPercent,
  vat,
  initial,
  drafts,
  concernOptions,
  todayAppointments = [],
}: {
  staff: { id: string; name: string }[];
  qpayMode: "api" | "manual";
  shiftOpen: boolean;
  canTransfer: boolean;
  maxDiscountPercent: number;
  vat: { included: boolean; rateBp: number };
  initial: PosInitial;
  drafts: PosDraftSummary[];
  concernOptions: { slug: string; name: string }[];
  /** Today's BOOKED/CONFIRMED/ARRIVED appointments (opening one creates/opens its draft) */
  todayAppointments?: { id: string; time: string; customer: string; service: string; staff: string; status: string }[];
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const d0 = initial.data;
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [lines, setLines] = useState<CartLine[]>(d0.lines);
  const [customer, setCustomer] = useState<PosCustomer | null>(d0.customer);
  const [saleDiscount, setSaleDiscount] = useState<Discount>(d0.saleDiscount);
  const [saleDiscountReason, setSaleDiscountReason] = useState(d0.saleDiscountReason);
  const [saleId, setSaleId] = useState<string | null>(initial.saleId);
  const [visitId, setVisitId] = useState<string | null>(d0.visitId);
  const appointmentId = d0.appointmentId;
  const [visitOpen, setVisitOpen] = useState(Boolean(d0.visit.skinType || d0.visit.concerns.length || d0.visit.notes || d0.visit.recs.length));
  const [skinType, setSkinType] = useState<SkinType | "">(d0.visit.skinType);
  const [concerns, setConcerns] = useState<string[]>(d0.visit.concerns);
  const [notes, setNotes] = useState(d0.visit.notes);
  const [recs, setRecs] = useState<Rec[]>(d0.visit.recs);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approval, setApproval] = useState({ email: "", password: "" });
  const [payment, setPayment] = useState(initial.payment);
  const [discardId, setDiscardId] = useState<string | null>(null);

  const checkout = useServerAction(posCheckout);
  const visitAction = useServerAction(saveVisitAction);
  const discard = useServerAction(posDiscardDraft);
  const openAppt = useServerAction(apptOpenPos);

  // ── Draft: debounced autosave ──
  const draft: DraftData = useMemo(
    () => ({
      lines: lines.map((l) => ({ ...l, discount: cleanDiscount(l.discount) })),
      customer,
      saleDiscount: cleanDiscount(saleDiscount),
      saleDiscountReason,
      visitId,
      appointmentId,
      visit: { skinType, concerns, notes, recs },
    }),
    [lines, customer, saleDiscount, saleDiscountReason, visitId, appointmentId, skinType, concerns, notes, recs],
  );
  const draftJson = JSON.stringify(draft);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(d0));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const savedJsonRef = useRef(savedJson);
  const saving = useRef<Promise<string | null> | null>(null);
  const latest = useRef({ draft, draftJson, saleId, locked: payment !== null });
  useEffect(() => {
    latest.current = { draft, draftJson, saleId, locked: payment !== null };
  });
  const dirty = payment === null && draftJson !== savedJson;

  /** Saves the current state and returns the saleId (concurrent calls are chained) */
  const flush = useCallback(async (): Promise<string | null> => {
    if (saving.current) await saving.current;
    const { draft: d, draftJson: json, saleId: id, locked } = latest.current;
    // Never save a locked sale (payment stage) back as a draft
    if (locked || json === savedJsonRef.current) return id;
    const run = (async () => {
      setSaveState("saving");
      const res = await posSaveDraft({ saleId: id, data: d }).catch(() => null);
      if (!res || !res.ok) {
        setSaveState("error");
        if (res && !res.ok && res.code === DRAFT_LOCKED) toast.error(res.error);
        return id;
      }
      savedJsonRef.current = json;
      setSavedJson(json);
      setSaveState("idle");
      if (res.data.saleId !== id) {
        setSaleId(res.data.saleId);
        latest.current.saleId = res.data.saleId;
        // Update the URL without remounting so a reload opens the same draft
        window.history.replaceState(null, "", `/admin/pos?sale=${res.data.saleId}`);
      }
      return res.data.saleId;
    })();
    saving.current = run;
    try {
      return await run;
    } finally {
      saving.current = null;
    }
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [draftJson, dirty, flush]);

  // Unsaved changes: reload/close → browser warning;
  // in-app links → save first, then navigate
  useEffect(() => {
    if (!dirty && saveState !== "saving") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      const href = a.pathname + a.search + a.hash;
      void flush().then(() => router.push(href));
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, saveState, flush, router]);

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
  const toggleConcern = (slug: string) => setConcerns((c) => (c.includes(slug) ? c.filter((x) => x !== slug) : [...c, slug]));

  const hasVisit = Boolean(skinType || concerns.length || notes.trim() || recs.length);

  /** Switch draft / new draft — save the current one first */
  const go = async (href: string) => {
    await flush();
    router.push(href);
  };
  const newSale = async () => {
    await flush();
    const res = await posNewDraft();
    if (res.ok) router.push(`/admin/pos?sale=${res.data.saleId}`);
    else toast.error(res.error);
  };

  const doCheckout = async (withApproval: boolean) => {
    if (lines.length === 0) return;
    // Save the draft first (checkout locks that DRAFT)
    const id = await flush();
    let vId = visitId;
    if (hasVisit) {
      if (!customer) return toast.error(s.visitNeedsCustomer);
      const v = await visitAction.run({
        visitId: vId,
        customerId: customer.id,
        appointmentId,
        skinType: skinType || null,
        concerns,
        diagnosisNotes: notes || null,
        recommendations: recs.map((r) => ({ variantId: r.variantId, instructions: r.instructions || null })),
      });
      if (!v.ok) return;
      vId = v.data.id;
      setVisitId(vId);
    }
    const res = await checkout.run({
      cart: {
        saleId: id,
        customerId: customer?.id ?? null,
        visitId: vId,
        appointmentId,
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
    });
    if (!res.ok) {
      if (res.code === APPROVAL_REQUIRED) setApprovalOpen(true);
      return;
    }
    setApprovalOpen(false);
    setSaleId(res.data.saleId);
    if (res.data.saleId !== id) window.history.replaceState(null, "", `/admin/pos?sale=${res.data.saleId}`);
    setPayment({
      sale: { id: res.data.saleId, number: res.data.number, total: res.data.total, paidAmount: 0, status: res.data.status },
      payments: [],
    });
  };

  const otherDrafts = drafts.filter((d) => d.id !== saleId);
  const draftBar = (
    <div className="mb-4 flex flex-wrap items-center gap-2 lg:col-span-2">
      <span className="text-[13px] font-medium text-navy/70">{s.drafts(otherDrafts.length + (saleId || dirty ? 1 : 0))}</span>
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-navy bg-white px-2.5 text-[13px]" aria-current="true">
        <FileText className="size-3.5" aria-hidden />
        {customer?.name ?? s.walkIn}
        <span className="text-navy/50" aria-live="polite">
          {saveState === "saving" ? s.saving : saveState === "error" ? s.saveFailed : dirty ? s.unsaved : saleId ? <Check className="inline size-3.5" aria-label={s.saved} /> : null}
        </span>
      </span>
      {otherDrafts.map((d) => (
        <span key={d.id} className="inline-flex h-8 items-center rounded-md border border-line bg-white text-[13px]">
          <button type="button" className="h-full px-2.5 hover:bg-navy/[0.03]" onClick={() => void go(`/admin/pos?sale=${d.id}`)}>
            {d.customerName ?? s.walkIn} <span className="text-navy/50">· {s.lineCount(d.lines)}</span>
          </button>
          <button type="button" className="h-full border-l border-line px-1.5 text-navy/45 hover:text-red-700" aria-label={`${s.discardDraft}: ${d.customerName ?? s.walkIn}`} onClick={() => setDiscardId(d.id)}>
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <Button size="sm" variant="secondary" onClick={() => void newSale()}>
        <Plus className="size-3.5" /> {s.newSale}
      </Button>
      <ConfirmDialog
        open={discardId !== null}
        title={s.discardDraft}
        confirmLabel={s.discardDraft}
        danger
        pending={discard.pending}
        onClose={() => setDiscardId(null)}
        onConfirm={() => discard.run(discardId!, { onSuccess: () => (setDiscardId(null), router.refresh()) })}
      >
        <p className="text-[14px]">{s.discardDraftHint}</p>
      </ConfirmDialog>
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      {draftBar}
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
              </div>
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium text-navy/80">{s.concerns}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {concernOptions.map((c) => {
                    const on = concerns.includes(c.slug);
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleConcern(c.slug)}
                        className={`rounded-full border px-3 py-1 text-[13px] ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-navy/75 hover:border-navy/40"}`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[12px] text-navy/50">{s.concernsHint}</p>
              </fieldset>
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
        <CustomerPicker
          customer={customer}
          onChange={setCustomer}
          extra={
            todayAppointments.length > 0 && (
              <div>
                <p className="mb-1 text-[12px] font-medium uppercase tracking-[0.4px] text-navy/55">{s.todayAppts}</p>
                <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-md border border-line">
                  {todayAppointments.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={openAppt.pending}
                        aria-label={s.openAppt(a.time, a.customer)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-navy/[0.03]"
                        onClick={async () => {
                          await flush();
                          void openAppt.run(a.id, { onSuccess: (r) => router.push(`/admin/pos?sale=${r.saleId}`) });
                        }}
                      >
                        <span className="min-w-0">
                          <span className="font-medium tabular-nums">{a.time}</span> {a.customer}
                          <span className="block truncate text-[12px] text-navy/55">
                            {a.service} · {a.staff}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-navy/50">{a.status}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        />

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

      <Dialog open={payment !== null} onClose={() => void newSale()} title={t.admin.payment.title(payment?.sale.number ?? "")}>
        {payment && (
          <PaymentPanel
            key={payment.sale.id}
            sale={payment.sale}
            payments={payment.payments}
            qpayMode={qpayMode}
            shiftOpen={shiftOpen}
            canTransfer={canTransfer}
            onDone={() => void newSale()}
            onUnlocked={() => {
              // Lines are a DRAFT again in the DB — save the cart as a draft again
              savedJsonRef.current = "";
              setSavedJson("");
              setPayment(null);
            }}
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
