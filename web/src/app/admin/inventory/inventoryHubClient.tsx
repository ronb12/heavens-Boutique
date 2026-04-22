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

export function InventoryHubClient({ initialTab }: { initialTab: "stock" | "history" }) {
  const [tab, setTab] = useState<"stock" | "history">(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [items, setItems] = useState<InvRow[]>([]);
  const [threshold, setThreshold] = useState(5);
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
  const [savingForm, setSavingForm] = useState(false);

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
    const m = new Map<string, { name: string; variants: InvRow[] }>();
    for (const it of pickerItems) {
      const cur = m.get(it.productId) ?? { name: it.productName, variants: [] as InvRow[] };
      if (!m.has(it.productId)) m.set(it.productId, cur);
      cur.variants.push(it);
    }
    for (const v of m.values()) {
      v.variants.sort((a, b) => (a.size || "").localeCompare(b.size || "", undefined, { numeric: true }));
    }
    return m;
  }, [pickerItems]);

  useEffect(() => {
    if (!formVariant) return;
    const row = pickerItems.find((i) => i.variantId === formVariant);
    if (row) setFormStock(String(row.stock));
  }, [formVariant, pickerItems]);

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
      setSavedMsg("Saved.");
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
    const n = Number(formStock);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      setError("On-hand quantity must be a whole number ≥ 0.");
      return;
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
      setFormStock(String(n));
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
      <p className="text-black/60 max-w-3xl">
        Manually enter on-hand quantities per variant (SKU/size)—like a standard inventory screen. Staff with{" "}
        <strong>Products</strong> or <strong>Inventory</strong> can edit here; changes are logged under{" "}
        <strong>Adjustment history</strong>. You can also set stock while editing a single product.
      </p>

      <div className="mt-8 flex flex-wrap gap-2 border-b border-black/10 pb-px">
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
        <div className="mt-6 space-y-4">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[color:var(--charcoal)]">Add or update inventory</h2>
            <p className="mt-1 text-sm text-black/55">
              Pick a variant, set on-hand count, and save. To create new products or sizes, go to{" "}
              <Link href="/admin/products" className="font-semibold text-[color:var(--gold)] no-underline hover:underline">
                Products
              </Link>
              .
            </p>
            {pickerLoading ? (
              <div className="mt-4 text-sm text-black/55">Loading products…</div>
            ) : (
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="grid min-w-0 flex-1 gap-1 sm:min-w-[16rem]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Variant</span>
                  <select
                    className="h-11 w-full min-w-0 max-w-lg rounded-2xl border border-black/10 bg-white px-3 text-sm"
                    value={formVariant}
                    onChange={(e) => setFormVariant(e.target.value)}
                    aria-label="Select product variant for inventory"
                  >
                    <option value="">— Choose variant —</option>
                    {Array.from(pickerByProduct.entries())
                      .sort(([, a], [, b]) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
                      .map(([productId, { name, variants }]) => (
                        <optgroup key={productId} label={name}>
                          {variants.map((v) => {
                            const label = [v.size, v.sku ? v.sku : null].filter(Boolean).join(" · ");
                            return (
                              <option key={v.variantId} value={v.variantId}>
                                {label || "Default"} — current: {v.stock}
                              </option>
                            );
                          })}
                        </optgroup>
                      ))}
                  </select>
                </label>
                <label className="grid gap-1 sm:w-36">
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
                    aria-label="On-hand quantity"
                  />
                </label>
                <div className="flex flex-wrap gap-2 sm:pl-0">
                  <button
                    type="button"
                    className="h-11 min-w-[8rem] rounded-2xl bg-[color:var(--gold)] px-5 font-semibold text-[color:var(--charcoal)] disabled:opacity-50"
                    disabled={!formVariant || savingForm}
                    onClick={() => saveFormInventory()}
                  >
                    {savingForm ? "Saving…" : "Save quantity"}
                  </button>
                  <button
                    type="button"
                    className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold"
                    onClick={() => loadPicker()}
                    disabled={pickerLoading}
                  >
                    Refresh list
                  </button>
                </div>
              </div>
            )}
            {!pickerLoading && !pickerItems.length ? (
              <p className="mt-3 text-sm text-black/50">Add products with variants in Products; then they will appear here.</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadStock();
                }}
                placeholder="Product, SKU, size…"
                className="h-11 min-w-[220px] rounded-2xl border border-black/10 bg-white px-4"
              />
            </label>
            <button
              type="button"
              className="h-11 rounded-2xl bg-[color:var(--gold)] px-5 font-semibold text-[color:var(--charcoal)]"
              onClick={() => loadStock()}
            >
              Apply
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
              Low stock only (≤ {threshold})
            </label>
          </div>

          {loading ? (
            <div className="text-black/60">Loading…</div>
          ) : (
            <>
              <div className="text-sm text-black/55">
                {filteredCount} variant{filteredCount === 1 ? "" : "s"}
              </div>
              <div className="overflow-x-auto rounded-3xl border border-black/10 bg-white/80">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10 bg-black/[0.03]">
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Variant</th>
                      <th className="px-4 py-3 font-semibold">SKU</th>
                      <th className="px-4 py-3 font-semibold">On hand</th>
                      <th className="px-4 py-3 font-semibold w-28" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const vid = it.variantId;
                      const changed = draft[vid] !== undefined && draft[vid] !== String(it.stock);
                      return (
                        <tr key={vid} className="border-b border-black/[0.06] last:border-0">
                          <td className="px-4 py-3 align-middle">
                            <Link
                              href={`/admin/products/${it.productId}`}
                              className="font-semibold text-[color:var(--gold)] no-underline hover:underline"
                            >
                              {it.productName}
                            </Link>
                            {it.lowStock ? (
                              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                                Low
                              </span>
                            ) : null}
                            <div className="text-xs text-black/45">{it.category || "—"}</div>
                          </td>
                          <td className="px-4 py-3 align-middle text-black/80">{it.size || "—"}</td>
                          <td className="px-4 py-3 align-middle font-mono text-xs text-black/70">{it.sku || "—"}</td>
                          <td className="px-4 py-3 align-middle">
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
                              className="h-10 w-24 rounded-xl border border-black/10 bg-white px-3 font-mono"
                            />
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <button
                              type="button"
                              disabled={!changed || savingId === vid}
                              onClick={() => saveRow(it)}
                              className="rounded-full bg-[color:var(--charcoal)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                            >
                              {savingId === vid ? "Saving…" : "Save"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!items.length ? (
                <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/55">No variants match.</div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
              onClick={() => loadAudit()}
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
