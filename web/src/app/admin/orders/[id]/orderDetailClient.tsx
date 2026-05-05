"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { formatUsd } from "@/lib/money";

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

type EasyPostRate = {
  id?: string;
  carrier?: string;
  service?: string;
  rate?: string;
  list_rate?: string;
};

type OrderDetail = {
  order: {
    id: string;
    status: string;
    trackingNumber: string | null;
    fulfillmentStatus: string;
    supplierOrderStatus: string;
    supplierName: string | null;
    supplierOrderUrl: string | null;
    supplierOrderNumber: string | null;
    supplierTrackingUrl: string | null;
    fulfillmentNotes: string | null;
    shippingAddress: Record<string, unknown> | null;
    labelUrl: string | null;
    carrier: string | null;
    service: string | null;
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
    createdAt: string;
    items: { id: string; productName: string; quantity: number; unitPriceCents: number; variantSize: string | null }[];
  };
};

export function AdminOrderDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shipError, setShipError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [tracking, setTracking] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("unfulfilled");
  const [supplierOrderStatus, setSupplierOrderStatus] = useState("not_needed");
  const [supplierName, setSupplierName] = useState("");
  const [supplierOrderUrl, setSupplierOrderUrl] = useState("");
  const [supplierOrderNumber, setSupplierOrderNumber] = useState("");
  const [supplierTrackingUrl, setSupplierTrackingUrl] = useState("");
  const [fulfillmentNotes, setFulfillmentNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [ratesBusy, setRatesBusy] = useState(false);
  const [buyBusy, setBuyBusy] = useState<string | null>(null);
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [rates, setRates] = useState<EasyPostRate[]>([]);

  const load = async () => {
    const r = await apiFetch<OrderDetail>(`/api/orders/${encodeURIComponent(id)}`, { method: "GET" });
    setData(r);
    setStatus(r.order.status);
    setTracking(r.order.trackingNumber || "");
    setFulfillmentStatus(r.order.fulfillmentStatus || "unfulfilled");
    setSupplierOrderStatus(r.order.supplierOrderStatus || "not_needed");
    setSupplierName(r.order.supplierName || "");
    setSupplierOrderUrl(r.order.supplierOrderUrl || "");
    setSupplierOrderNumber(r.order.supplierOrderNumber || "");
    setSupplierTrackingUrl(r.order.supplierTrackingUrl || "");
    setFulfillmentNotes(r.order.fulfillmentNotes || "");
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        await load();
      } catch (e: unknown) {
        if (mounted) setError(errMsg(e, "Failed to load order"));
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const o = data?.order;

  return (
    <AdminShell title={`Order ${id.slice(0, 8)}`}>
      <div className="mb-6">
        <Link href="/admin/orders" className="font-semibold text-[color:var(--gold)] no-underline">
          ← Back to orders
        </Link>
      </div>

      {error ? <div className="text-sm text-rose-700 font-semibold">{error}</div> : null}
      {saved ? <div className="text-sm text-emerald-700 font-semibold">{saved}</div> : null}

      {o ? (
        <div className="grid gap-4 lg:grid-cols-3 items-start">
          <div className="lg:col-span-2 rounded-3xl border border-black/10 bg-white/80 p-6">
            <div className="font-semibold text-lg">Items</div>
            <div className="mt-4 grid gap-3">
              {o.items.map((it) => (
                <div key={it.id} className="rounded-2xl border border-black/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{it.productName}</div>
                      <div className="text-sm text-black/55">
                        {it.variantSize ? `Size: ${it.variantSize} · ` : ""}Qty {it.quantity}
                      </div>
                    </div>
                    <div className="font-semibold">{formatUsd(it.unitPriceCents * it.quantity)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/80 p-6 h-fit">
            <div className="font-semibold text-lg">Update</div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
              <div className="font-semibold">Shipping label (EasyPost)</div>
              <div className="mt-1 text-sm text-black/60">
                Fetch rates, purchase a label, and automatically set tracking + fulfillment status.
              </div>

              {shipError ? <div className="mt-3 text-sm text-rose-700 font-semibold">{shipError}</div> : null}

              {o.labelUrl ? (
                <div className="mt-3 text-sm">
                  <div className="text-black/60">Label</div>
                  <a className="font-semibold text-[color:var(--gold)] break-all" href={o.labelUrl} target="_blank" rel="noreferrer">
                    Open label PDF
                  </a>
                  <div className="mt-2 text-black/60">
                    {(o.carrier || "").toString()} {(o.service || "").toString()}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                disabled={ratesBusy}
                className="mt-4 h-11 w-full rounded-full border border-black/10 bg-white font-semibold disabled:opacity-60"
                onClick={async () => {
                  setShipError(null);
                  setRatesBusy(true);
                  setRates([]);
                  setShipmentId(null);
                  try {
                    const r = await apiFetch<{ shipmentId: string; rates: EasyPostRate[] }>(
                      `/api/admin/easypost/${encodeURIComponent(id)}/rates`,
                      { method: "GET" },
                    );
                    setShipmentId(String(r.shipmentId || ""));
                    setRates(Array.isArray(r.rates) ? r.rates : []);
                  } catch (e: unknown) {
                    setShipError(errMsg(e, "Could not fetch rates"));
                  } finally {
                    setRatesBusy(false);
                  }
                }}
              >
                {ratesBusy ? "Fetching rates…" : "Fetch shipping rates"}
              </button>

              {rates.length ? (
                <div className="mt-4 grid gap-2">
                  {rates.map((rate) => {
                    const rateId = String(rate?.id || "");
                    const carrier = String(rate?.carrier || "");
                    const service = String(rate?.service || "");
                    const amount = String(rate?.rate ?? rate?.list_rate ?? "");
                    return (
                      <div key={rateId || `${carrier}-${service}`} className="rounded-2xl border border-black/10 bg-white p-3">
                        <div className="font-semibold">
                          {carrier} · {service}
                        </div>
                        <div className="mt-1 text-sm text-black/60">{amount ? `$${amount}` : "Rate"}</div>
                        <button
                          type="button"
                          disabled={!rateId || buyBusy === rateId}
                          className="mt-3 h-10 w-full rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
                          onClick={async () => {
                            setShipError(null);
                            setBuyBusy(rateId);
                            try {
                              await apiFetch(`/api/admin/easypost/${encodeURIComponent(id)}/buy`, {
                                method: "POST",
                                body: JSON.stringify({ shipmentId, rateId }),
                              });
                              await load();
                              setRates([]);
                              setShipmentId(null);
                            } catch (e: unknown) {
                              setShipError(errMsg(e, "Purchase failed"));
                            } finally {
                              setBuyBusy(null);
                            }
                          }}
                        >
                          {buyBusy === rateId ? "Buying…" : "Buy label"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <label className="mt-4 grid gap-2">
              <span className="text-sm font-semibold">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-11 rounded-2xl border border-black/10 bg-white px-4"
              >
                {["pending", "paid", "shipped", "delivered", "cancelled", "refunded"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 grid gap-2">
              <span className="text-sm font-semibold">Fulfillment</span>
              <select
                value={fulfillmentStatus}
                onChange={(e) => setFulfillmentStatus(e.target.value)}
                className="h-11 rounded-2xl border border-black/10 bg-white px-4"
              >
                {["unfulfilled", "needs_supplier_order", "supplier_ordered", "supplier_shipped", "label_purchased", "packed", "handed_off", "delivered"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
              <div className="font-semibold">Supplier order</div>
              <p className="mt-1 text-sm text-black/60">
                Use this when an order needs to be placed with AliExpress or a partner warehouse.
              </p>

              <label className="mt-4 grid gap-2">
                <span className="text-sm font-semibold">Supplier status</span>
                <select
                  value={supplierOrderStatus}
                  onChange={(e) => setSupplierOrderStatus(e.target.value)}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                >
                  {["not_needed", "needs_order", "ordered", "supplier_shipped", "received", "cancelled"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-3 grid gap-2">
                <span className="text-sm font-semibold">Supplier</span>
                <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="h-11 rounded-2xl border border-black/10 bg-white px-4" placeholder="AliExpress" />
              </label>

              <label className="mt-3 grid gap-2">
                <span className="text-sm font-semibold">Supplier order URL</span>
                <input value={supplierOrderUrl} onChange={(e) => setSupplierOrderUrl(e.target.value)} className="h-11 rounded-2xl border border-black/10 bg-white px-4" placeholder="https://" />
              </label>

              <label className="mt-3 grid gap-2">
                <span className="text-sm font-semibold">Supplier order number</span>
                <input value={supplierOrderNumber} onChange={(e) => setSupplierOrderNumber(e.target.value)} className="h-11 rounded-2xl border border-black/10 bg-white px-4" placeholder="Optional" />
              </label>

              <label className="mt-3 grid gap-2">
                <span className="text-sm font-semibold">Supplier tracking URL</span>
                <input value={supplierTrackingUrl} onChange={(e) => setSupplierTrackingUrl(e.target.value)} className="h-11 rounded-2xl border border-black/10 bg-white px-4" placeholder="https://" />
              </label>

              <label className="mt-3 grid gap-2">
                <span className="text-sm font-semibold">Fulfillment notes</span>
                <textarea value={fulfillmentNotes} onChange={(e) => setFulfillmentNotes(e.target.value)} rows={3} className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm" placeholder="Size checked, U.S. warehouse selected, backup supplier..." />
              </label>
            </div>

            <label className="mt-4 grid gap-2">
              <span className="text-sm font-semibold">Tracking number</span>
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                placeholder="Optional"
              />
            </label>

            <button
              type="button"
              disabled={saving}
              className="mt-6 h-12 w-full rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
              onClick={async () => {
                setSaving(true);
                setSaved(null);
                setError(null);
                try {
                  await apiFetch(`/api/orders/${encodeURIComponent(id)}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      status,
                      trackingNumber: tracking || null,
                      fulfillmentStatus,
                      supplierOrderStatus,
                      supplierName: supplierName || null,
                      supplierOrderUrl: supplierOrderUrl || null,
                      supplierOrderNumber: supplierOrderNumber || null,
                      supplierTrackingUrl: supplierTrackingUrl || null,
                      fulfillmentNotes: fulfillmentNotes || null,
                    }),
                  });
                  setSaved("Saved.");
                  await load();
                } catch (e: unknown) {
                  setError(errMsg(e, "Save failed"));
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save updates"}
            </button>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
