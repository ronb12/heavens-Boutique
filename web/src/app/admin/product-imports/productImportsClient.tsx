"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { formatUsd } from "@/lib/money";

type ImportItem = {
  id: string;
  status: string;
  supplierName: string | null;
  supplierUrl: string;
  title: string | null;
  boutiqueName: string | null;
  category: string | null;
  description: string | null;
  priceCents: number | null;
  salePriceCents: number | null;
  costCents: number | null;
  imageUrls: string[];
  sizes: string[];
  stock: number;
  shipsFrom: string | null;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  backupSupplierUrl: string | null;
  notes: string | null;
  publishedProductId: string | null;
};

const inputClass = "h-10 rounded-2xl border border-black/10 bg-white px-3 text-sm";
const textareaClass = "min-h-20 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm";

function centsText(cents: number | null) {
  return cents == null ? "" : (Math.round(cents) / 100).toFixed(2);
}

function parseDollar(s: string) {
  const n = Number.parseFloat(s.trim().replace(/^\$\s*/, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

function profit(item: ImportItem) {
  const revenue = item.salePriceCents ?? item.priceCents;
  if (revenue == null || item.costCents == null) return null;
  return revenue - item.costCents;
}

export function ProductImportsClient() {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [urls, setUrls] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await apiFetch<{ items: ImportItem[] }>("/api/admin/product-imports", { method: "GET" });
    setItems(r.items || []);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load import queue"));
    });
  }, []);

  async function patchItem(item: ImportItem, changes: Partial<ImportItem>) {
    setError(null);
    setStatus(null);
    const body = {
      status: changes.status,
      supplierName: changes.supplierName,
      supplierUrl: changes.supplierUrl,
      title: changes.title,
      boutiqueName: changes.boutiqueName,
      category: changes.category,
      description: changes.description,
      priceCents: changes.priceCents,
      salePriceCents: changes.salePriceCents,
      costCents: changes.costCents,
      imageUrls: changes.imageUrls,
      sizes: changes.sizes,
      stock: changes.stock,
      shipsFrom: changes.shipsFrom,
      deliveryDaysMin: changes.deliveryDaysMin,
      deliveryDaysMax: changes.deliveryDaysMax,
      backupSupplierUrl: changes.backupSupplierUrl,
      notes: changes.notes,
    };
    const r = await apiFetch<{ item: ImportItem }>(`/api/admin/product-imports?id=${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setItems((xs) => xs.map((x) => (x.id === item.id ? r.item : x)));
  }

  return (
    <AdminShell title="Supplier import queue">
      <div className="grid gap-6">
        <section className="rounded-3xl border border-black/10 bg-white/80 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Add supplier URLs</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-black/60">
                Paste up to 100 live AliExpress or supplier links. They become drafts so the owner can rewrite names,
                add prices/images/sizes, then publish reviewed products to the storefront.
              </p>
            </div>
            <Link href="/admin/products-csv" className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold no-underline">
              CSV bulk import
            </Link>
          </div>

          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            className="mt-4 min-h-32 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            placeholder={"https://www.aliexpress.us/item/...\nhttps://www.aliexpress.us/item/..."}
          />
          <button
            type="button"
            disabled={busy}
            className="mt-4 rounded-full bg-[color:var(--gold)] px-6 py-3 font-semibold text-[color:var(--charcoal)] disabled:opacity-60"
            onClick={async () => {
              setBusy(true);
              setError(null);
              setStatus(null);
              try {
                await apiFetch("/api/admin/product-imports", {
                  method: "POST",
                  body: JSON.stringify({ urls, supplierName: "AliExpress", category: "Dresses", stock: 10 }),
                });
                setUrls("");
                setStatus("Drafts added.");
                await load();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Could not add drafts");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Adding…" : "Add to queue"}
          </button>
        </section>

        {status ? <div className="text-sm font-semibold text-emerald-700">{status}</div> : null}
        {error ? <div className="text-sm font-semibold text-rose-700">{error}</div> : null}

        <section className="grid gap-4">
          {items.map((item) => {
            const p = profit(item);
            return (
              <div key={item.id} className="rounded-3xl border border-black/10 bg-white/80 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40">{item.status}</div>
                    <a href={item.supplierUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate font-semibold text-[color:var(--gold)]">
                      {item.supplierUrl}
                    </a>
                  </div>
                  {item.publishedProductId ? (
                    <Link href={`/admin/products/${item.publishedProductId}`} className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 no-underline">
                      View product
                    </Link>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-4">
                  <input className={inputClass} value={item.boutiqueName || ""} placeholder="Boutique name" onChange={(e) => setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, boutiqueName: e.target.value } : x))} />
                  <input className={inputClass} value={item.category || ""} placeholder="Category" onChange={(e) => setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, category: e.target.value } : x))} />
                  <input className={inputClass} value={centsText(item.priceCents)} placeholder="Price" inputMode="decimal" onChange={(e) => setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, priceCents: parseDollar(e.target.value) } : x))} />
                  <input className={inputClass} value={centsText(item.costCents)} placeholder="Supplier cost" inputMode="decimal" onChange={(e) => setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, costCents: parseDollar(e.target.value) } : x))} />
                  <input className={inputClass} value={(item.sizes || []).join("|")} placeholder="Sizes: S|M|L|XL" onChange={(e) => setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, sizes: e.target.value.split("|").map((v) => v.trim()).filter(Boolean) } : x))} />
                  <input className={inputClass} value={String(item.stock || 0)} placeholder="Stock" inputMode="numeric" onChange={(e) => setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, stock: Number(e.target.value) || 0 } : x))} />
                  <input className={inputClass} value={item.shipsFrom || ""} placeholder="Ships from: US warehouse" onChange={(e) => setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, shipsFrom: e.target.value } : x))} />
                  <input className={inputClass} value={item.backupSupplierUrl || ""} placeholder="Backup supplier URL" onChange={(e) => setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, backupSupplierUrl: e.target.value } : x))} />
                  <textarea className={`${textareaClass} lg:col-span-2`} value={item.description || ""} placeholder="Boutique description" onChange={(e) => setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, description: e.target.value } : x))} />
                  <textarea className={`${textareaClass} lg:col-span-2`} value={(item.imageUrls || []).join("\n")} placeholder="Image URLs, one per line" onChange={(e) => setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, imageUrls: e.target.value.split(/\n/).map((v) => v.trim()).filter(Boolean) } : x))} />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white p-4">
                  <div className="text-sm text-black/60">
                    Profit preview: <span className="font-semibold text-black/80">{p == null ? "Add cost + price" : formatUsd(p)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold" onClick={() => patchItem(item, item)}>
                      Save draft
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm font-semibold text-[color:var(--charcoal)]"
                      onClick={async () => {
                        try {
                          await patchItem(item, { ...item, status: "ready" });
                          await apiFetch(`/api/admin/product-imports?id=${encodeURIComponent(item.id)}&action=publish`, { method: "POST" });
                          setStatus("Product published.");
                          await load();
                        } catch (e: unknown) {
                          setError(e instanceof Error ? e.message : "Could not publish");
                        }
                      }}
                    >
                      Publish product
                    </button>
                    <button type="button" className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-800" onClick={() => patchItem(item, { status: "archived" })}>
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!items.length ? (
            <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60">No supplier drafts yet.</div>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}
