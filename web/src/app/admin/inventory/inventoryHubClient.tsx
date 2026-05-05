"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";

type InvRow = {
  variantId: string;
  productId: string;
  productName: string;
  category: string | null;
  size: string;
  sku: string | null;
  stock: number;
  lowStock: boolean;
  imageRef: string | null;
};

type AuditRow = {
  id: string;
  variantId: string;
  productName: string | null;
  size: string | null;
  delta: number;
  reason: string;
  createdAt: string;
};

function isHttpImageUrl(s: string | null | undefined): s is string {
  return Boolean(s && /^https?:\/\//i.test(s.trim()));
}

type StockState = "out" | "low" | "ok";

function rowStockState(stock: number, threshold: number): StockState {
  if (stock <= 0) return "out";
  if (stock <= threshold) return "low";
  return "ok";
}

function StockBadge({ state, threshold }: { state: StockState; threshold: number }) {
  if (state === "out") {
    return (
      <span className="inline-flex items-center rounded-full border border-rose-200/90 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
        Out of stock
      </span>
    );
  }
  if (state === "low") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200/90 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
        Low (≤{threshold})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200/90 bg-emerald-50/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
      In stock
    </span>
  );
}

function VariantThumb({ name, refUrl }: { name: string; refUrl: string | null }) {
  const [broke, setBroke] = useState(false);
  const showImg = isHttpImageUrl(refUrl) && !broke;
  return (
    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-black/[0.08] bg-black/[0.04]">
      {showImg ? (
        <img
          src={refUrl!}
          alt=""
          className="h-12 w-12 object-cover"
          onError={() => setBroke(true)}
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center text-xs font-bold text-black/30">
          {(name.trim()[0] ?? "?").toUpperCase()}
        </div>
      )}
    </div>
  );
}

export function InventoryHubClient({ initialTab }: { initialTab: "stock" | "history" }) {
  const [tab, setTab] = useState<"stock" | "history">(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [items, setItems] = useState<InvRow[]>([]);
  const [threshold, setThreshold] = useState(5);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [pickerItems, setPickerItems] = useState<InvRow[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [formVariant, setFormVariant] = useState<string>("");
  const [formStock, setFormStock] = useState<string>("");
  const [formAddQty, setFormAddQty] = useState<string>("");
  const [formMode, setFormMode] = useState<"set" | "add">("set");
  const [savingForm, setSavingForm] = useState(false);
  const [addProductFilter, setAddProductFilter] = useState("");

  // Debounce list search
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const loadStock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (lowOnly) params.set("lowStock", "1");
      const q = params.toString();
      const r = await apiFetch<{ items: InvRow[]; lowStockThreshold: number }>(
        `/api/admin/inventory${q ? `?${q}` : ""}`,
        { method: "GET" },
      );
      setItems(r.items || []);
      setThreshold(Number(r.lowStockThreshold) || 5);
      const d: Record<string, string> = {};
      for (const it of r.items || []) {
        d[it.variantId] = String(it.stock);
      }
      setDraft(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [search, lowOnly]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ rows: AuditRow[] }>("/api/admin/inventory-audit", { method: "GET" });
      setAuditRows(r.rows || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const loadPicker = useCallback(async () => {
    setPickerLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ items: InvRow[]; lowStockThreshold: number }>("/api/admin/inventory", {
        method: "GET",
      });
      setPickerItems(r.items || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load product list for add inventory");
    } finally {
      setPickerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "stock") loadStock();
  }, [tab, loadStock]);

  useEffect(() => {
    if (tab === "stock") loadPicker();
  }, [tab, loadPicker]);

  useEffect(() => {
    if (tab === "history") loadAudit();
  }, [tab, loadAudit]);

  const filteredCount = useMemo(() => items.length, [items]);

  const pickerByProduct = useMemo(() => {
    const f = addProductFilter.trim().toLowerCase();
    const m = new Map<string, { name: string; variants: InvRow[] }>();
    for (const it of pickerItems) {
      if (f) {
        const n = (it.productName || "").toLowerCase();
        if (!n.includes(f)) continue;
      }
      const cur = m.get(it.productId) ?? { name: it.productName, variants: [] as InvRow[] };
      if (!m.has(it.productId)) m.set(it.productId, cur);
      cur.variants.push(it);
    }
    for (const v of m.values()) {
      v.variants.sort((a, b) => (a.size || "").localeCompare(b.size || "", undefined, { numeric: true }));
    }
    return m;
  }, [pickerItems, addProductFilter]);

  const selectedFormRow = useMemo(
    () => (formVariant ? pickerItems.find((i) => i.variantId === formVariant) : undefined),
    [formVariant, pickerItems],
  );

  useEffect(() => {
    if (!formVariant) {
      setFormStock("");
      setFormAddQty("");
      return;
    }
    const row = pickerItems.find((i) => i.variantId === formVariant);
    if (row) {
      setFormStock(String(row.stock));
      if (formMode === "add") setFormAddQty("1");
    }
  }, [formVariant, pickerItems, formMode]);

  async function saveRow(it: InvRow) {
    const raw = draft[it.variantId];
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      setError("Quantity must be a whole number ≥ 0.");
      return;
    }
    setSavingId(it.variantId);
    setError(null);
    setSavedMsg(null);
    try {
      await apiFetch("/api/admin/inventory", {
        method: "PATCH",
        body: JSON.stringify({
          updates: [{ productId: it.productId, variantId: it.variantId, stock: n }],
        }),
      });
      setSavedMsg("Updated.");
      await loadStock();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function saveFormInventory() {
    const it = pickerItems.find((i) => i.variantId === formVariant);
    if (!it) {
      setError("Select a product variant first.");
      return;
    }
    let n: number;
    if (formMode === "add") {
      const d = Number(formAddQty);
      if (!Number.isFinite(d) || d === 0 || !Number.isInteger(d)) {
        setError("Enter a whole number to add (negative allowed to remove stock, not below zero in total).");
        return;
      }
      n = it.stock + d;
      if (n < 0) {
        setError("On-hand can’t be negative. Reduce the removal amount or set quantity directly.");
        return;
      }
    } else {
      n = Number(formStock);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        setError("On-hand quantity must be a whole number ≥ 0.");
        return;
      }
    }
    setSavingForm(true);
    setError(null);
    setSavedMsg(null);
    try {
      await apiFetch("/api/admin/inventory", {
        method: "PATCH",
        body: JSON.stringify({
          updates: [{ productId: it.productId, variantId: it.variantId, stock: n }],
        }),
      });
      if (formMode === "add") {
        setFormAddQty("1");
      } else {
        setFormStock(String(n));
      }
      setSavedMsg("Saved.");
      await loadStock();
      await loadPicker();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingForm(false);
    }
  }

  return (
    <AdminShell title="Inventory">
      <p className="max-w-3xl text-black/60">
        Track on-hand stock by variant (SKU), receive or adjust counts, and review the history. Create new products and
        sizes in{" "}
        <Link href="/admin/products" className="font-semibold text-[color:var(--gold)] no-underline hover:underline">
          Products
        </Link>
        .
      </p>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-black/10 pb-px">
        <Link
          href="/admin/inventory"
          scroll={false}
          className={`rounded-t-xl px-4 py-2.5 text-sm font-semibold no-underline transition-colors ${
            tab === "stock"
              ? "bg-[color:var(--gold)]/25 text-[color:var(--charcoal)]"
              : "text-black/60 hover:bg-black/[0.04]"
          }`}
        >
          On hand
        </Link>
        <Link
          href="/admin/inventory?tab=history"
          scroll={false}
          className={`rounded-t-xl px-4 py-2.5 text-sm font-semibold no-underline transition-colors ${
            tab === "history"
              ? "bg-[color:var(--gold)]/25 text-[color:var(--charcoal)]"
              : "text-black/60 hover:bg-black/[0.04]"
          }`}
        >
          Adjustment history
        </Link>
      </div>

      {savedMsg ? <div className="mt-4 text-sm font-semibold text-emerald-700">{savedMsg}</div> : null}
      {error ? <div className="mt-4 text-sm font-semibold text-rose-700">{error}</div> : null}

      {tab === "stock" ? (
        <div className="mt-6 space-y-6">
          {/* Add inventory — primary action card */}
          <section className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
            <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-5 py-4 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">
                Receive & adjust
              </p>
              <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
                Add or update inventory
              </h2>
              <p className="mt-1.5 text-sm text-black/55">Choose a variant, then set on-hand or add (or remove) units.</p>
            </div>
            <div className="p-5 sm:p-6">
              {pickerLoading ? (
                <div className="text-sm text-black/55">Loading products…</div>
              ) : (
                <div className="grid gap-4 lg:max-w-4xl">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Filter products</span>
                    <input
                      className="h-11 w-full max-w-md rounded-2xl border border-black/10 bg-white px-3 text-sm"
                      value={addProductFilter}
                      onChange={(e) => setAddProductFilter(e.target.value)}
                      placeholder="Type to search by product name"
                    />
                  </label>

                  <div className="flex flex-wrap gap-4 sm:gap-6">
                    <span className="text-xs font-semibold uppercase tracking-wide text-black/45 self-center">
                      How to update
                    </span>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="invFormMode"
                        checked={formMode === "set"}
                        onChange={() => setFormMode("set")}
                      />
                      Set on hand
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="invFormMode"
                        checked={formMode === "add"}
                        onChange={() => setFormMode("add")}
                      />
                      Add or remove
                    </label>
                  </div>

                  {selectedFormRow && formMode === "add" ? (
                    <p className="text-sm text-black/50">
                      Current: <span className="font-mono font-medium text-[color:var(--charcoal)]">{selectedFormRow.stock}</span> on hand. Positive adds stock; negative subtracts.
                    </p>
                  ) : null}

                  {selectedFormRow ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#fbf8fa]/80 px-3 py-2">
                      <VariantThumb name={selectedFormRow.productName} refUrl={selectedFormRow.imageRef} />
                      <div className="min-w-0 text-sm">
                        <div className="font-semibold text-[color:var(--charcoal)]">{selectedFormRow.productName}</div>
                        <div className="text-black/60">
                          {[selectedFormRow.size, selectedFormRow.sku].filter(Boolean).join(" · ") || "Variant"}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="grid min-w-0 flex-1 gap-1.5 sm:min-w-[18rem]">
                      <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Variant</span>
                      <select
                        className="h-11 w-full min-w-0 max-w-2xl rounded-2xl border border-black/10 bg-white px-3 text-sm"
                        value={formVariant}
                        onChange={(e) => setFormVariant(e.target.value)}
                        aria-label="Select product variant for inventory"
                      >
                        <option value="">— Search and choose a variant —</option>
                        {Array.from(pickerByProduct.entries())
                          .sort(([, a], [, b]) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
                          .map(([productId, { name, variants }]) => (
                            <optgroup key={productId} label={name}>
                              {variants.map((v) => {
                                const label = [v.size, v.sku ? v.sku : null].filter(Boolean).join(" · ");
                                return (
                                  <option key={v.variantId} value={v.variantId}>
                                    {label || "Default"} — on hand: {v.stock}
                                  </option>
                                );
                              })}
                            </optgroup>
                          ))}
                      </select>
                    </label>

                    {formMode === "set" ? (
                      <label className="grid w-full gap-1.5 sm:w-32">
                        <span className="text-xs font-semibold uppercase tracking-wide text-black/45">On hand</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={formStock}
                          onChange={(e) => setFormStock(e.target.value)}
                          disabled={!formVariant}
                          className="h-11 rounded-2xl border border-black/10 bg-white px-3 font-mono"
                          placeholder="0"
                        />
                      </label>
                    ) : (
                      <label className="grid w-full gap-1.5 sm:w-36">
                        <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Add / remove</span>
                        <input
                          type="number"
                          step={1}
                          inputMode="numeric"
                          value={formAddQty}
                          onChange={(e) => setFormAddQty(e.target.value)}
                          disabled={!formVariant}
                          className="h-11 rounded-2xl border border-black/10 bg-white px-3 font-mono"
                          placeholder="0"
                        />
                      </label>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="h-11 min-w-[8.5rem] rounded-2xl bg-[color:var(--charcoal)] px-5 text-sm font-semibold text-white disabled:opacity-50"
                        disabled={!formVariant || savingForm}
                        onClick={() => void saveFormInventory()}
                      >
                        {savingForm ? "Saving…" : "Save inventory"}
                      </button>
                      <button
                        type="button"
                        className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold"
                        onClick={() => void loadPicker()}
                        disabled={pickerLoading}
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {!pickerLoading && !pickerItems.length ? (
                <p className="mt-3 text-sm text-black/50">
                  Add products with variants under Products — they will show up here.
                </p>
              ) : null}
            </div>
          </section>

          {/* All inventory list */}
          <section className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
            <div className="border-b border-black/[0.06] px-5 py-4 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">List</p>
              <h2 className="mt-0.5 text-lg font-semibold text-[color:var(--charcoal)]">All inventory</h2>
              <p className="mt-1 text-sm text-black/55">Every variant with live count — edit a row, then update.</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-end gap-3 border-b border-black/10 pb-4 sm:gap-4">
                <label className="grid min-w-0 flex-1 gap-1.5 sm:min-w-[220px] sm:max-w-md">
                  <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Search</span>
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Product, SKU, size, category"
                    className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4"
                  />
                </label>
                <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-[color:var(--charcoal)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-black/20"
                    checked={lowOnly}
                    onChange={(e) => setLowOnly(e.target.checked)}
                  />
                  Low only (≤ {threshold})
                </label>
                <button
                  type="button"
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold"
                  onClick={() => void loadStock()}
                >
                  Reload
                </button>
              </div>

              {loading ? (
                <div className="pt-6 text-sm text-black/60">Loading inventory…</div>
              ) : (
                <>
                  <div className="mt-4 text-sm text-black/50">
                    {filteredCount} variant{filteredCount === 1 ? "" : "s"}
                    {lowOnly ? " (low stock filter)" : ""}
                  </div>
                  <div className="mt-3 overflow-x-auto rounded-2xl border border-black/10">
                    <table className="w-full min-w-[800px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-black/10 bg-[#fbf8fa]">
                          <th className="w-16 px-3 py-3 font-semibold" aria-hidden>
                            <span className="sr-only">Image</span>
                          </th>
                          <th className="px-3 py-3 font-semibold">Product & variant</th>
                          <th className="px-3 py-3 font-semibold">SKU</th>
                          <th className="px-3 py-3 font-semibold">Status</th>
                          <th className="px-3 py-3 font-semibold w-32">On hand</th>
                          <th className="px-3 py-3 font-semibold w-32">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => {
                          const vid = it.variantId;
                          const changed = draft[vid] !== undefined && draft[vid] !== String(it.stock);
                          const sState = rowStockState(it.stock, threshold);
                          return (
                            <tr
                              key={vid}
                              className={`border-b border-black/[0.06] last:border-0 ${i % 2 ? "bg-black/[0.01]" : ""}`}
                            >
                              <td className="px-3 py-3 align-middle">
                                <VariantThumb name={it.productName} refUrl={it.imageRef} />
                              </td>
                              <td className="px-3 py-3 align-middle">
                                <Link
                                  href={`/admin/products/${it.productId}`}
                                  className="font-semibold text-[color:var(--gold)] no-underline hover:underline"
                                >
                                  {it.productName}
                                </Link>
                                {it.size ? (
                                  <div className="mt-0.5 text-sm text-black/65">{it.size}</div>
                                ) : null}
                                <div className="text-xs text-black/40">{it.category || "—"}</div>
                              </td>
                              <td className="px-3 py-3 align-middle font-mono text-xs text-black/70">{it.sku || "—"}</td>
                              <td className="px-3 py-3 align-middle">
                                <StockBadge state={sState} threshold={threshold} />
                              </td>
                              <td className="px-3 py-3 align-middle">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  inputMode="numeric"
                                  value={draft[vid] ?? String(it.stock)}
                                  onChange={(e) =>
                                    setDraft((d) => ({
                                      ...d,
                                      [vid]: e.target.value,
                                    }))
                                  }
                                  className="h-9 w-24 rounded-xl border border-black/10 bg-white px-2.5 font-mono text-sm"
                                />
                              </td>
                              <td className="px-3 py-3 align-middle">
                                <button
                                  type="button"
                                  disabled={!changed || savingId === vid}
                                  onClick={() => void saveRow(it)}
                                  className="rounded-full bg-[color:var(--gold)] px-4 py-2 text-xs font-semibold text-[color:var(--charcoal)] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {savingId === vid ? "Saving…" : "Update"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!items.length ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-black/12 bg-white p-8 text-center text-sm text-black/50">
                      No matching variants. Clear search or the low-only filter.
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
              onClick={() => void loadAudit()}
            >
              Refresh history
            </button>
          </div>
          {auditLoading ? <div className="text-black/60">Loading…</div> : null}
          {!auditLoading && (
            <div className="grid gap-3">
              {auditRows.map((e) => (
                <div key={e.id} className="rounded-3xl border border-black/10 bg-white/80 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {e.delta > 0 ? `+${e.delta}` : e.delta}
                      <span className="font-normal text-black/55"> · {e.reason}</span>
                    </span>
                    <span className="text-xs text-black/45">{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-sm text-black/60">
                    {(e.productName || "Product") + (e.size ? ` · ${e.size}` : "")}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-black/40">Variant {e.variantId.slice(0, 8)}…</div>
                </div>
              ))}
              {!auditRows.length ? (
                <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/55">No adjustments logged yet.</div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
