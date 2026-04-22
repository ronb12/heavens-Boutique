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
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUSES = ["draft", "ordered", "shipped", "received", "cancelled"] as const;

const INPUT_CLASS =
  "h-11 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[color:var(--charcoal)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-black/35 focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

const TEXTAREA_CLASS =
  "min-h-[7.5rem] w-full rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-[color:var(--charcoal)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-black/35 focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

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

export function PurchaseOrdersClient() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<PurchaseOrder[]>([]);

  const [supplierName, setSupplierName] = React.useState("");
  const [supplierOrderUrl, setSupplierOrderUrl] = React.useState("");
  const [supplierOrderNumber, setSupplierOrderNumber] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ purchaseOrders: PurchaseOrder[] }>(
        "/api/admin/purchase-orders",
        { auth: true },
      );
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

  async function createDraft() {
    setError(null);
    setCreating(true);
    try {
      await apiFetch<{ ok: true; id: string }>("/api/admin/purchase-orders", {
        method: "POST",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "draft",
          supplierName: supplierName.trim() || null,
          supplierOrderUrl: supplierOrderUrl.trim() || null,
          supplierOrderNumber: supplierOrderNumber.trim() || null,
          notes: notes.trim() || null,
          items: [],
        }),
      });
      setSupplierName("");
      setSupplierOrderUrl("");
      setSupplierOrderNumber("");
      setNotes("");
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update");
    }
  }

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
        <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">Procurement</p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[color:var(--charcoal)]">
            New purchase order
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/55">
            Track buys from any source—showrooms, FashionGo-style portals, marketplaces, reps, or email invoices. Starts as a{" "}
            <span className="font-semibold text-black/75">draft</span>; add line items after creation. Marking{" "}
            <span className="font-semibold text-black/75">received</span> applies variant stock when lines are linked.
          </p>
        </div>

        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-5 border-l-[3px] border-[color:var(--gold)]/85 pl-5 md:col-span-2">
              <label className="grid gap-2">
                <FieldLabel hint="Who you’re buying from — doesn’t need to match product supplier fields.">Supplier name</FieldLabel>
                <input
                  className={INPUT_CLASS}
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. LA showroom, FashionGo, marketplace seller…"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <FieldLabel hint="B2B reorder page, marketplace order detail, or hosted invoice/PDF.">Order URL</FieldLabel>
              <input
                type="url"
                className={INPUT_CLASS}
                value={supplierOrderUrl}
                onChange={(e) => setSupplierOrderUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>

            <label className="grid gap-2">
              <FieldLabel hint="Your PO #, invoice ID, or marketplace confirmation.">Order number</FieldLabel>
              <input
                className={INPUT_CLASS}
                value={supplierOrderNumber}
                onChange={(e) => setSupplierOrderNumber(e.target.value)}
                placeholder="Optional"
              />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <FieldLabel hint="SKU notes, ship windows, terms — anything your team needs later.">Notes</FieldLabel>
              <textarea
                className={TEXTAREA_CLASS}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What you ordered, sizes, ship-to, special instructions…"
              />
            </label>
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
            {error ? (
              <div className="text-sm font-semibold text-rose-700">{error}</div>
            ) : (
              <p className="text-sm text-black/45">You can attach receipt lines after the draft is created.</p>
            )}
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
            <p className="mt-1 text-sm text-black/55">Newest first.</p>
          </div>
          {loading ? <div className="text-sm font-medium text-black/50">Loading…</div> : null}
        </div>

        <div className="overflow-x-auto p-2 sm:p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">
                <th className="px-5 py-3">Supplier</th>
                <th className="px-3 py-3">Order #</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Updated</th>
                <th className="px-5 py-3">Link</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-black/[0.04] transition-colors hover:bg-[#fffafb]/80">
                  <td className="px-5 py-3 font-medium text-[color:var(--charcoal)]">{r.supplierName || "—"}</td>
                  <td className="px-3 py-3 text-black/75">{r.supplierOrderNumber || "—"}</td>
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
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-black/50" colSpan={5}>
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
