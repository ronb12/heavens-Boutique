"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type PurchaseOrder = {
  id: string;
  status: string;
  supplierName: string | null;
  supplierOrderUrl: string | null;
  supplierOrderNumber: string | null;
  expectedAt: string | null;
  paymentTerms: string | null;
  shipTo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  subtotalCents: number;
};

type PoItem = {
  id: string;
  productId: string | null;
  variantId: string | null;
  quantity: number;
  unitCostCents: number | null;
  supplierUrl: string | null;
  title: string | null;
  productName: string | null;
  variantSize: string | null;
  qualitySpec: string | null;
  lineTotalCents: number | null;
  createdAt: string;
};

type PurchaseOrderDetail = {
  id: string;
  status: string;
  supplierName: string | null;
  supplierOrderUrl: string | null;
  supplierOrderNumber: string | null;
  expectedAt: string | null;
  paymentTerms: string | null;
  shipTo: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  items: PoItem[];
  subtotalCents: number;
  itemCount: number;
};

const STATUSES = ["draft", "ordered", "shipped", "received", "cancelled"] as const;

const INPUT_CLASS =
  "h-11 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[color:var(--charcoal)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-black/35 focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

const INPUT_SMALL_CLASS =
  "h-10 w-full min-w-0 rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[color:var(--charcoal)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none placeholder:text-black/35 focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

const TEXTAREA_CLASS =
  "min-h-[7.5rem] w-full rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-[color:var(--charcoal)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-black/35 focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

const TEXTAREA_SMALL_CLASS =
  "min-h-[4rem] w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-[color:var(--charcoal)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none placeholder:text-black/35 focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

const SELECT_STATUS_CLASS =
  "h-9 rounded-xl border border-black/[0.08] bg-white px-3 text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="grid gap-0.5">
      <span className="text-sm font-semibold text-[color:var(--charcoal)]">{children}</span>
      {hint ? <span className="text-xs font-normal text-black/45">{hint}</span> : null}
    </span>
  );
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function dollarsToCents(s: string): number | null {
  const t = s.trim().replace(/[$,]/g, "");
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function centsToDollarsField(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2);
}

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type LineDraft = {
  key: string;
  productId: string;
  variantId: string;
  title: string;
  quantity: string;
  unitPrice: string;
  qualitySpec: string;
  supplierUrl: string;
};

function emptyLine(): LineDraft {
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `l-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: "",
    variantId: "",
    title: "",
    quantity: "1",
    unitPrice: "",
    qualitySpec: "",
    supplierUrl: "",
  };
}

function linesToPayload(lines: LineDraft[]) {
  const out: Array<{
    productId: string | null;
    variantId: string | null;
    title: string;
    quantity: number;
    unitCostCents: number | null;
    qualitySpec: string | null;
    supplierUrl: string | null;
  }> = [];
  for (const L of lines) {
    const qty = Number.parseInt(L.quantity, 10);
    const unitCostCents = dollarsToCents(L.unitPrice);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const titleTrim = L.title.trim();
    const pid = L.productId.trim();
    const vid = L.variantId.trim();
    if (!titleTrim && !pid && !vid) continue;
    out.push({
      productId: pid || null,
      variantId: vid || null,
      title: titleTrim || "Line item",
      quantity: qty,
      unitCostCents: unitCostCents ?? null,
      qualitySpec: L.qualitySpec.trim() || null,
      supplierUrl: L.supplierUrl.trim() || null,
    });
  }
  return out;
}

function itemsToDrafts(items: PoItem[]): LineDraft[] {
  if (!items.length) return [emptyLine()];
  return items.map((it) => ({
    key: it.id,
    productId: it.productId ?? "",
    variantId: it.variantId ?? "",
    title: it.title || it.productName || "",
    quantity: String(it.quantity),
    unitPrice: centsToDollarsField(it.unitCostCents ?? null),
    qualitySpec: it.qualitySpec ?? "",
    supplierUrl: it.supplierUrl ?? "",
  }));
}

function LineItemsBlock({
  lines,
  onChange,
  readOnly,
  legend,
}: {
  lines: LineDraft[];
  onChange: (next: LineDraft[]) => void;
  readOnly: boolean;
  legend: string;
}) {
  const subtotal = lines.reduce((acc, L) => {
    const qty = Number.parseInt(L.quantity, 10);
    const c = dollarsToCents(L.unitPrice);
    if (!Number.isFinite(qty) || qty <= 0 || c == null) return acc;
    return acc + c * qty;
  }, 0);

  return (
    <fieldset className="grid gap-4 border-0 p-0">
      <legend className="mb-1 text-sm font-semibold text-[color:var(--charcoal)]">{legend}</legend>
      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-[#fffefb]/80">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] bg-white/90 text-[10px] font-semibold uppercase tracking-[0.1em] text-black/45">
              <th className="px-3 py-2.5">Description</th>
              <th className="px-3 py-2.5">Qty</th>
              <th className="px-3 py-2.5">Unit price</th>
              <th className="px-3 py-2.5">Line total</th>
              <th className="min-w-[8rem] px-3 py-2.5">Quality / spec</th>
              <th className="px-3 py-2.5">Product ID</th>
              <th className="px-3 py-2.5">Variant ID</th>
              {!readOnly ? <th className="px-3 py-2.5 w-16" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((L, idx) => {
              const qty = Number.parseInt(L.quantity, 10);
              const uc = dollarsToCents(L.unitPrice);
              const lineTot =
                Number.isFinite(qty) && qty > 0 && uc != null ? formatUsd(uc * qty) : "—";
              return (
                <tr key={L.key} className="border-b border-black/[0.04] align-top">
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span className="text-[color:var(--charcoal)]">{L.title || "—"}</span>
                    ) : (
                      <input
                        className={INPUT_SMALL_CLASS}
                        value={L.title}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...L, title: e.target.value };
                          onChange(next);
                        }}
                        placeholder="Style / SKU / description"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 w-20">
                    {readOnly ? (
                      L.quantity
                    ) : (
                      <input
                        type="number"
                        min={1}
                        className={INPUT_SMALL_CLASS}
                        value={L.quantity}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...L, quantity: e.target.value };
                          onChange(next);
                        }}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 w-28">
                    {readOnly ? (
                      uc != null ? formatUsd(uc) : "—"
                    ) : (
                      <input
                        className={INPUT_SMALL_CLASS}
                        inputMode="decimal"
                        value={L.unitPrice}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...L, unitPrice: e.target.value };
                          onChange(next);
                        }}
                        placeholder="0.00"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-black/75">{lineTot}</td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span className="text-black/70">{L.qualitySpec || "—"}</span>
                    ) : (
                      <textarea
                        className={TEXTAREA_SMALL_CLASS}
                        value={L.qualitySpec}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...L, qualitySpec: e.target.value };
                          onChange(next);
                        }}
                        placeholder="Fabric, grade, color standard…"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[7rem]">
                    {readOnly ? (
                      <span className="break-all text-xs text-black/55">{L.productId || "—"}</span>
                    ) : (
                      <input
                        className={`${INPUT_SMALL_CLASS} font-mono text-xs`}
                        value={L.productId}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...L, productId: e.target.value };
                          onChange(next);
                        }}
                        placeholder="UUID"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[7rem]">
                    {readOnly ? (
                      <span className="break-all text-xs text-black/55">{L.variantId || "—"}</span>
                    ) : (
                      <input
                        className={`${INPUT_SMALL_CLASS} font-mono text-xs`}
                        value={L.variantId}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...L, variantId: e.target.value };
                          onChange(next);
                        }}
                        placeholder="UUID"
                      />
                    )}
                  </td>
                  {!readOnly ? (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-700 hover:underline"
                        onClick={() => onChange(lines.filter((_, j) => j !== idx))}
                      >
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!readOnly ? (
        <button
          type="button"
          className="justify-self-start rounded-full border border-black/[0.1] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--charcoal)] shadow-sm hover:border-[color:var(--gold)]/40"
          onClick={() => onChange([...lines, emptyLine()])}
        >
          Add line
        </button>
      ) : null}
      <p className="text-sm font-semibold text-[color:var(--charcoal)]">
        Subtotal (priced lines): <span className="text-[color:var(--gold)]">{formatUsd(subtotal)}</span>
      </p>
    </fieldset>
  );
}

export function PurchaseOrdersClient() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<PurchaseOrder[]>([]);

  const [supplierName, setSupplierName] = React.useState("");
  const [supplierOrderUrl, setSupplierOrderUrl] = React.useState("");
  const [supplierOrderNumber, setSupplierOrderNumber] = React.useState("");
  const [expectedAt, setExpectedAt] = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("");
  const [shipTo, setShipTo] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [createLines, setCreateLines] = React.useState<LineDraft[]>([emptyLine()]);
  const [creating, setCreating] = React.useState(false);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editDetail, setEditDetail] = React.useState<PurchaseOrderDetail | null>(null);
  const [efStatus, setEfStatus] = React.useState("");
  const [efSupplierName, setEfSupplierName] = React.useState("");
  const [efSupplierOrderUrl, setEfSupplierOrderUrl] = React.useState("");
  const [efSupplierOrderNumber, setEfSupplierOrderNumber] = React.useState("");
  const [efExpectedAt, setEfExpectedAt] = React.useState("");
  const [efPaymentTerms, setEfPaymentTerms] = React.useState("");
  const [efShipTo, setEfShipTo] = React.useState("");
  const [efNotes, setEfNotes] = React.useState("");
  const [efLines, setEfLines] = React.useState<LineDraft[]>([emptyLine()]);
  const [savingEdit, setSavingEdit] = React.useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ purchaseOrders: PurchaseOrder[] }>("/api/admin/purchase-orders", {
        auth: true,
      });
      setRows(data.purchaseOrders || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  React.useEffect(() => {
    if (!editingId) {
      setEditDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setEditLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ purchaseOrder: PurchaseOrderDetail }>(
          `/api/admin/purchase-orders?id=${editingId}`,
          { auth: true },
        );
        if (cancelled) return;
        setEditDetail(data.purchaseOrder);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load PO");
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  React.useEffect(() => {
    if (!editDetail) return;
    setEfStatus(editDetail.status);
    setEfSupplierName(editDetail.supplierName ?? "");
    setEfSupplierOrderUrl(editDetail.supplierOrderUrl ?? "");
    setEfSupplierOrderNumber(editDetail.supplierOrderNumber ?? "");
    setEfExpectedAt(isoToDatetimeLocal(editDetail.expectedAt));
    setEfPaymentTerms(editDetail.paymentTerms ?? "");
    setEfShipTo(editDetail.shipTo ?? "");
    setEfNotes(editDetail.notes ?? "");
    setEfLines(itemsToDrafts(editDetail.items));
  }, [editDetail]);

  async function createDraft() {
    setError(null);
    setCreating(true);
    try {
      const items = linesToPayload(createLines);
      await apiFetch<{ ok: true; id: string }>("/api/admin/purchase-orders", {
        method: "POST",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "draft",
          supplierName: supplierName.trim() || null,
          supplierOrderUrl: supplierOrderUrl.trim() || null,
          supplierOrderNumber: supplierOrderNumber.trim() || null,
          expectedAt: expectedAt.trim() ? new Date(expectedAt).toISOString() : null,
          paymentTerms: paymentTerms.trim() || null,
          shipTo: shipTo.trim() || null,
          notes: notes.trim() || null,
          items,
        }),
      });
      setSupplierName("");
      setSupplierOrderUrl("");
      setSupplierOrderNumber("");
      setExpectedAt("");
      setPaymentTerms("");
      setShipTo("");
      setNotes("");
      setCreateLines([emptyLine()]);
      setEditingId(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/admin/purchase-orders?id=${id}`, {
        method: "PATCH",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
      if (editingId === id && editDetail) {
        setEditDetail({ ...editDetail, status });
        setEfStatus(status);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function saveEdit() {
    if (!editingId || !editDetail) return;
    setError(null);
    setSavingEdit(true);
    try {
      const payload: Record<string, unknown> = {
        status: efStatus,
        supplierName: efSupplierName.trim() || null,
        supplierOrderUrl: efSupplierOrderUrl.trim() || null,
        supplierOrderNumber: efSupplierOrderNumber.trim() || null,
        expectedAt: efExpectedAt.trim() ? new Date(efExpectedAt).toISOString() : null,
        paymentTerms: efPaymentTerms.trim() || null,
        shipTo: efShipTo.trim() || null,
        notes: efNotes.trim() || null,
      };
      const linesLocked = efStatus === "received" || efStatus === "cancelled";
      if (!linesLocked) {
        payload.items = linesToPayload(efLines);
      }
      await apiFetch<{ ok: true }>(`/api/admin/purchase-orders?id=${editingId}`, {
        method: "PATCH",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setEditingId(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingEdit(false);
    }
  }

  const linesReadOnly = efStatus === "received" || efStatus === "cancelled";

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
        <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">Procurement</p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[color:var(--charcoal)]">
            New purchase order
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/55">
            Draft a PO with supplier details, terms, ship-to, expected delivery, and line items (quantity, unit price, quality
            notes). Link catalog variants by UUID so marking <span className="font-semibold text-black/75">received</span> can
            restock automatically.
          </p>
        </div>

        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-5 border-l-[3px] border-[color:var(--gold)]/85 pl-5 md:col-span-2">
              <label className="grid gap-2">
                <FieldLabel hint="Vendor or marketplace you’re buying from.">Supplier name</FieldLabel>
                <input
                  className={INPUT_CLASS}
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. LA showroom, FashionGo, marketplace seller…"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <FieldLabel hint="B2B reorder page, marketplace order detail, or invoice link.">Order URL</FieldLabel>
              <input
                type="url"
                className={INPUT_CLASS}
                value={supplierOrderUrl}
                onChange={(e) => setSupplierOrderUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>

            <label className="grid gap-2">
              <FieldLabel hint="PO #, invoice ID, or confirmation number.">Order number</FieldLabel>
              <input
                className={INPUT_CLASS}
                value={supplierOrderNumber}
                onChange={(e) => setSupplierOrderNumber(e.target.value)}
                placeholder="Optional"
              />
            </label>

            <label className="grid gap-2">
              <FieldLabel hint="When you expect delivery or the vendor’s ship window.">Expected delivery</FieldLabel>
              <input
                type="datetime-local"
                className={INPUT_CLASS}
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
              />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <FieldLabel hint="Net days, deposit, FOB, incoterms, etc.">Payment / terms</FieldLabel>
              <textarea
                className={TEXTAREA_CLASS}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30, 50% deposit, FOB Los Angeles…"
              />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <FieldLabel hint="Warehouse, store, or attention line.">Ship to</FieldLabel>
              <textarea
                className={TEXTAREA_CLASS}
                value={shipTo}
                onChange={(e) => setShipTo(e.target.value)}
                placeholder="Full ship-to address or internal location code…"
              />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <FieldLabel hint="Anything else the team should know.">Notes</FieldLabel>
              <textarea
                className={TEXTAREA_CLASS}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes…"
              />
            </label>
          </div>

          <div className="mt-8">
            <LineItemsBlock
              lines={createLines}
              onChange={setCreateLines}
              readOnly={false}
              legend="Line items"
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-black/[0.06] bg-gradient-to-r from-[#fdf5fa]/90 via-white to-[#fffafb] p-5">
            <button
              type="button"
              disabled={creating}
              className="inline-flex h-12 min-w-[10rem] items-center justify-center rounded-full bg-[color:var(--gold)] px-8 text-sm font-semibold text-[color:var(--charcoal)] shadow-[0_6px_24px_rgba(212,175,55,0.38)] transition hover:brightness-[1.06] disabled:opacity-60"
              onClick={createDraft}
            >
              {creating ? "Creating…" : "Create draft"}
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center rounded-full border border-black/[0.1] bg-white px-6 text-sm font-semibold text-[color:var(--charcoal)] shadow-sm transition hover:border-[color:var(--gold)]/35 hover:bg-[#fffafb]"
              onClick={load}
            >
              Refresh list
            </button>
            {error ? <div className="text-sm font-semibold text-rose-700">{error}</div> : null}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">History</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
              Purchase orders
            </h2>
            <p className="mt-1 text-sm text-black/55">Newest first. Edit lines and pricing until the PO is received or cancelled.</p>
          </div>
          {loading ? <div className="text-sm font-medium text-black/50">Loading…</div> : null}
        </div>

        <div className="overflow-x-auto p-2 sm:p-0">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">
                <th className="px-5 py-3">Supplier</th>
                <th className="px-3 py-3">Order #</th>
                <th className="px-3 py-3">Lines</th>
                <th className="px-3 py-3">Subtotal</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Updated</th>
                <th className="px-3 py-3">Edit</th>
                <th className="px-5 py-3">Link</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-black/[0.04] transition-colors hover:bg-[#fffafb]/80">
                    <td className="px-5 py-3 font-medium text-[color:var(--charcoal)]">{r.supplierName || "—"}</td>
                    <td className="px-3 py-3 text-black/75">{r.supplierOrderNumber || "—"}</td>
                    <td className="px-3 py-3 text-black/70">{r.itemCount ?? 0}</td>
                    <td className="px-3 py-3 text-black/75">{formatUsd(r.subtotalCents ?? 0)}</td>
                    <td className="px-3 py-3">
                      <select
                        className={SELECT_STATUS_CLASS}
                        value={r.status}
                        onChange={(e) => updateStatus(r.id, e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-black/50">{new Date(r.updatedAt).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="text-sm font-semibold text-[color:var(--gold)] hover:underline"
                        onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                      >
                        {editingId === r.id ? "Close" : "Edit"}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      {r.supplierOrderUrl ? (
                        <a
                          className="font-semibold text-[color:var(--gold)] underline-offset-2 hover:underline"
                          href={r.supplierOrderUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-black/35">—</span>
                      )}
                    </td>
                  </tr>
                  {editingId === r.id ? (
                    <tr className="border-b border-black/[0.06] bg-[#fffefb]/95">
                      <td colSpan={8} className="px-5 py-6">
                        {editLoading ? (
                          <p className="text-sm text-black/55">Loading purchase order…</p>
                        ) : editDetail ? (
                          <div className="grid gap-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
                              Edit #{editDetail.id.slice(0, 8)}…
                            </p>
                            <div className="grid gap-5 md:grid-cols-2">
                              <label className="grid gap-2">
                                <FieldLabel>Status</FieldLabel>
                                <select
                                  className={INPUT_CLASS}
                                  value={efStatus}
                                  onChange={(e) => setEfStatus(e.target.value)}
                                >
                                  {STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="grid gap-2">
                                <FieldLabel>Expected delivery</FieldLabel>
                                <input
                                  type="datetime-local"
                                  className={INPUT_CLASS}
                                  value={efExpectedAt}
                                  onChange={(e) => setEfExpectedAt(e.target.value)}
                                />
                              </label>
                              <label className="grid gap-2 md:col-span-2">
                                <FieldLabel>Supplier name</FieldLabel>
                                <input
                                  className={INPUT_CLASS}
                                  value={efSupplierName}
                                  onChange={(e) => setEfSupplierName(e.target.value)}
                                />
                              </label>
                              <label className="grid gap-2">
                                <FieldLabel>Order URL</FieldLabel>
                                <input
                                  type="url"
                                  className={INPUT_CLASS}
                                  value={efSupplierOrderUrl}
                                  onChange={(e) => setEfSupplierOrderUrl(e.target.value)}
                                />
                              </label>
                              <label className="grid gap-2">
                                <FieldLabel>Order number</FieldLabel>
                                <input
                                  className={INPUT_CLASS}
                                  value={efSupplierOrderNumber}
                                  onChange={(e) => setEfSupplierOrderNumber(e.target.value)}
                                />
                              </label>
                              <label className="grid gap-2 md:col-span-2">
                                <FieldLabel>Payment / terms</FieldLabel>
                                <textarea
                                  className={TEXTAREA_CLASS}
                                  value={efPaymentTerms}
                                  onChange={(e) => setEfPaymentTerms(e.target.value)}
                                />
                              </label>
                              <label className="grid gap-2 md:col-span-2">
                                <FieldLabel>Ship to</FieldLabel>
                                <textarea
                                  className={TEXTAREA_CLASS}
                                  value={efShipTo}
                                  onChange={(e) => setEfShipTo(e.target.value)}
                                />
                              </label>
                              <label className="grid gap-2 md:col-span-2">
                                <FieldLabel>Notes</FieldLabel>
                                <textarea
                                  className={TEXTAREA_CLASS}
                                  value={efNotes}
                                  onChange={(e) => setEfNotes(e.target.value)}
                                />
                              </label>
                            </div>
                            {linesReadOnly ? (
                              <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950/90">
                                Line items are read-only for received or cancelled POs.
                              </p>
                            ) : null}
                            <LineItemsBlock
                              lines={efLines}
                              onChange={setEfLines}
                              readOnly={linesReadOnly}
                              legend="Line items (description, quantity, unit price, quality)"
                            />
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                disabled={savingEdit}
                                className="inline-flex h-11 min-w-[8rem] items-center justify-center rounded-full bg-[color:var(--gold)] px-6 text-sm font-semibold text-[color:var(--charcoal)] shadow-md disabled:opacity-60"
                                onClick={saveEdit}
                              >
                                {savingEdit ? "Saving…" : "Save changes"}
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-11 items-center justify-center rounded-full border border-black/[0.1] bg-white px-5 text-sm font-semibold text-[color:var(--charcoal)]"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-rose-700">Could not load this PO.</p>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-black/50" colSpan={8}>
                    No purchase orders yet — create a draft above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-black/[0.06] px-6 py-4">
          <Link href="/admin" className="text-sm font-semibold text-[color:var(--gold)] no-underline hover:underline">
            ← Admin home
          </Link>
        </div>
      </div>
    </div>
  );
}
