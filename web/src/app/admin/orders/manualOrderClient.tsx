"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import type { ProductDTO, ProductVariantDTO } from "@/lib/types";
import { formatUsd } from "@/lib/money";

type CustomerRow = {
  id: string;
  email: string | null;
  fullName: string | null;
};

type LineRow = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  /** Dollar string for input, e.g. "19.99" */
  unitDollars: string;
};

function newLine(): LineRow {
  return {
    id: typeof crypto !== "undefined" ? crypto.randomUUID() : `l-${Date.now()}-${Math.random()}`,
    productId: "",
    variantId: "",
    quantity: 1,
    unitDollars: "",
  };
}

function effectiveUnitCents(p: ProductDTO | undefined, v: ProductVariantDTO | undefined): number {
  if (!p) return 0;
  const base = p.salePriceCents ?? p.priceCents;
  return Math.max(0, base);
}

const INPUT =
  "h-11 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[color:var(--charcoal)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-black/35 focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

export function ManualOrderClient() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** registered | guest */
  const [buyerKind, setBuyerKind] = useState<"registered" | "guest">("guest");
  const [selectedUserId, setSelectedUserId] = useState("");
  /** When customer dropdown is unavailable or you copy id from elsewhere */
  const [manualUserId, setManualUserId] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPostal, setAddrPostal] = useState("");
  const [addrCountry, setAddrCountry] = useState("US");

  const [status, setStatus] = useState("paid");
  const [decrementStock, setDecrementStock] = useState(true);
  const [discountDollars, setDiscountDollars] = useState("");
  const [taxDollars, setTaxDollars] = useState("");
  const [shippingDollars, setShippingDollars] = useState("");

  const [lines, setLines] = useState<LineRow[]>(() => [newLine()]);

  useEffect(() => {
    let m = true;
    (async () => {
      setLoadError(null);
      try {
        const r = await apiFetch<{ products: ProductDTO[] }>("/api/products", { method: "GET" });
        if (m) setProducts(r.products || []);
      } catch (e: unknown) {
        if (m) setLoadError(e instanceof Error ? e.message : "Could not load products");
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        const r = await apiFetch<{ customers: CustomerRow[] }>("/api/admin/customers", { method: "GET" });
        if (m) setCustomers(r.customers || []);
      } catch {
        if (m) setCustomers([]);
      } finally {
        if (m) setCustomersLoaded(true);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  const productsById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const subtotalCents = useMemo(() => {
    let sum = 0;
    for (const line of lines) {
      const p = productsById[line.productId];
      const v = p?.variants?.find((x) => x.id === line.variantId);
      const q = Math.max(1, Math.floor(Number(line.quantity)) || 0);
      const dollars = parseFloat(line.unitDollars);
      const cents = Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
      if (p && v && q > 0 && cents >= 0) sum += cents * q;
    }
    return sum;
  }, [lines, productsById]);

  const discountCents = Math.max(0, Math.round((parseFloat(discountDollars) || 0) * 100));
  const taxCents = Math.max(0, Math.round((parseFloat(taxDollars) || 0) * 100));
  const shippingCents = Math.max(0, Math.round((parseFloat(shippingDollars) || 0) * 100));
  const totalCents = Math.max(0, subtotalCents - discountCents + taxCents + shippingCents);

  function applyProduct(lineId: string, productId: string) {
    const p = productsById[productId];
    const v = p?.variants?.[0];
    const cents = effectiveUnitCents(p, v);
    setLines((rows) =>
      rows.map((row) =>
        row.id === lineId
          ? {
              ...row,
              productId,
              variantId: v?.id ?? "",
              unitDollars: cents ? (cents / 100).toFixed(2) : "",
            }
          : row,
      ),
    );
  }

  function applyVariant(lineId: string, variantId: string) {
    setLines((rows) =>
      rows.map((row) => {
        if (row.id !== lineId) return row;
        const p = productsById[row.productId];
        const v = p?.variants?.find((x) => x.id === variantId);
        const cents = effectiveUnitCents(p, v);
        return {
          ...row,
          variantId,
          unitDollars: cents ? (cents / 100).toFixed(2) : row.unitDollars,
        };
      }),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const resolvedUserId = (selectedUserId.trim() || manualUserId.trim()).trim();

    if (buyerKind === "registered") {
      if (!resolvedUserId) {
        setSubmitError("Choose a customer from the list or paste their user ID (UUID).");
        return;
      }
    } else {
      const em = guestEmail.trim().toLowerCase();
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setSubmitError("Enter a valid guest email.");
        return;
      }
    }

    const items: { productId: string; variantId: string; quantity: number; unitPriceCents: number }[] = [];
    for (const line of lines) {
      const p = productsById[line.productId];
      const v = p?.variants?.find((x) => x.id === line.variantId);
      const q = Math.floor(Number(line.quantity));
      const dollars = parseFloat(line.unitDollars);
      const unitPriceCents = Math.round(dollars * 100);
      if (!p || !v) {
        setSubmitError("Each line needs a product and variant.");
        return;
      }
      if (!Number.isInteger(q) || q < 1 || q > 999) {
        setSubmitError("Quantity must be between 1 and 999.");
        return;
      }
      if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
        setSubmitError("Each line needs a valid unit price.");
        return;
      }
      items.push({ productId: p.id, variantId: v.id, quantity: q, unitPriceCents });
    }

    if (items.length === 0) {
      setSubmitError("Add at least one line item.");
      return;
    }

    const shippingAddress: Record<string, string> = {};
    if (addrLine1.trim()) shippingAddress.line1 = addrLine1.trim();
    if (addrLine2.trim()) shippingAddress.line2 = addrLine2.trim();
    if (addrCity.trim()) shippingAddress.city = addrCity.trim();
    if (addrState.trim()) shippingAddress.state = addrState.trim();
    if (addrPostal.trim()) shippingAddress.postal = addrPostal.trim();
    if (addrCountry.trim()) shippingAddress.country = addrCountry.trim();

    const payload: Record<string, unknown> = {
      status,
      items,
      discountCents,
      taxCents,
      shippingCents,
      decrementStock,
      shippingAddress: Object.keys(shippingAddress).length ? shippingAddress : undefined,
      guestName: guestName.trim() || undefined,
      guestPhone: guestPhone.trim() || undefined,
    };

    if (buyerKind === "registered") {
      payload.userId = resolvedUserId;
    } else {
      payload.guestEmail = guestEmail.trim().toLowerCase();
    }

    setSubmitting(true);
    try {
      const r = await apiFetch<{ orderId: string }>("/api/admin/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/admin/orders/${encodeURIComponent(r.orderId)}`);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Could not create order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminShell title="Place manual order">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/90 px-4 py-2 text-sm font-semibold text-[color:var(--charcoal)] shadow-sm transition hover:border-[color:var(--gold)]/35 hover:bg-[#fffafb]"
        >
          <span className="text-[color:var(--gold)]">←</span>
          All orders
        </Link>
      </div>

      <p className="max-w-2xl text-sm leading-relaxed text-black/60">
        Record phone sales, in-store pickup, or off-Stripe payments. Inventory follows your status and{" "}
        <span className="font-semibold text-black/75">Decrement stock</span> toggle (typically on for{" "}
        <span className="font-semibold">paid</span> / shipped / delivered).
      </p>

      {loadError ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {loadError}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 grid max-w-4xl gap-8">
        <section className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
          <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">Customer</p>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
              Who is this order for?
            </h2>
          </div>
          <div className="grid gap-5 p-6">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setBuyerKind("guest")}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  buyerKind === "guest"
                    ? "bg-[color:var(--gold)] text-[color:var(--charcoal)] shadow-md"
                    : "border border-black/10 bg-white text-black/70 hover:bg-black/[0.03]"
                }`}
              >
                Guest (email)
              </button>
              <button
                type="button"
                onClick={() => setBuyerKind("registered")}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  buyerKind === "registered"
                    ? "bg-[color:var(--gold)] text-[color:var(--charcoal)] shadow-md"
                    : "border border-black/10 bg-white text-black/70 hover:bg-black/[0.03]"
                }`}
              >
                Registered account
              </button>
            </div>

            {buyerKind === "guest" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm font-semibold text-[color:var(--charcoal)]">Email</span>
                  <input
                    type="email"
                    className={INPUT}
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="customer@example.com"
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[color:var(--charcoal)]">Name (optional)</span>
                  <input className={INPUT} value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[color:var(--charcoal)]">Phone (optional)</span>
                  <input className={INPUT} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
                </label>
              </div>
            ) : (
              <div className="grid gap-4">
                {customers.length > 0 ? (
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[color:var(--charcoal)]">Customer</span>
                    <select
                      className={INPUT}
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      <option value="">Select customer…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {(c.email || "—") + (c.fullName ? ` · ${c.fullName}` : "")}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : customersLoaded ? (
                  <p className="text-sm text-black/55">
                    Customer directory isn&apos;t available on your permission set. Paste the account ID from{" "}
                    <Link href="/admin/customers" className="font-semibold text-[color:var(--gold)]">
                      Customers
                    </Link>{" "}
                    below.
                  </p>
                ) : (
                  <p className="text-sm text-black/45">Loading customers…</p>
                )}
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[color:var(--charcoal)]">
                    Or paste customer user ID
                  </span>
                  <input
                    className={`${INPUT} font-mono text-sm`}
                    value={manualUserId}
                    onChange={(e) => setManualUserId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    autoComplete="off"
                  />
                  <span className="text-xs text-black/45">
                    If you pick from the list, leave this blank (list wins when both are set—clear the list to use ID).
                  </span>
                </label>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
          <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">Shipping</p>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
              Address (optional)
            </h2>
            <p className="mt-1 text-sm text-black/55">Include if you need it on packing slips or labels.</p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-semibold">Street line 1</span>
              <input className={INPUT} value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-semibold">Street line 2</span>
              <input className={INPUT} value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">City</span>
              <input className={INPUT} value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">State / province</span>
              <input className={INPUT} value={addrState} onChange={(e) => setAddrState(e.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Postal code</span>
              <input className={INPUT} value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Country</span>
              <input className={INPUT} value={addrCountry} onChange={(e) => setAddrCountry(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">Lines</p>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
                Items
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setLines((rows) => [...rows, newLine()])}
              className="rounded-full border border-black/[0.08] bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:border-[color:var(--gold)]/40"
            >
              Add line
            </button>
          </div>

          <div className="grid gap-4 p-6">
            {lines.map((line) => {
              const p = line.productId ? productsById[line.productId] : undefined;
              const variants = p?.variants ?? [];
              const v = variants.find((x) => x.id === line.variantId);
              return (
                <div
                  key={line.id}
                  className="grid gap-3 rounded-2xl border border-black/[0.06] bg-gradient-to-br from-white to-[#fffafb]/50 p-4 md:grid-cols-12 md:items-end"
                >
                  <label className="grid gap-2 md:col-span-5">
                    <span className="text-xs font-semibold text-black/55">Product</span>
                    <select
                      className={INPUT}
                      value={line.productId}
                      onChange={(e) => applyProduct(line.id, e.target.value)}
                      required
                    >
                      <option value="">Choose…</option>
                      {products.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 md:col-span-3">
                    <span className="text-xs font-semibold text-black/55">Variant</span>
                    <select
                      className={INPUT}
                      value={line.variantId}
                      onChange={(e) => applyVariant(line.id, e.target.value)}
                      disabled={!p}
                      required
                    >
                      <option value="">—</option>
                      {variants.map((vv) => (
                        <option key={vv.id} value={vv.id}>
                          {vv.size || "Size"} · stock {vv.stock}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-xs font-semibold text-black/55">Qty</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      className={INPUT}
                      value={line.quantity}
                      onChange={(e) =>
                        setLines((rows) =>
                          rows.map((r) => (r.id === line.id ? { ...r, quantity: Number(e.target.value) || 1 } : r)),
                        )
                      }
                    />
                  </label>
                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-xs font-semibold text-black/55">Unit price ($)</span>
                    <input
                      className={INPUT}
                      inputMode="decimal"
                      value={line.unitDollars}
                      onChange={(e) =>
                        setLines((rows) =>
                          rows.map((r) => (r.id === line.id ? { ...r, unitDollars: e.target.value } : r)),
                        )
                      }
                      placeholder="0.00"
                    />
                  </label>
                  {lines.length > 1 ? (
                    <div className="md:col-span-12 flex justify-end">
                      <button
                        type="button"
                        className="text-sm font-semibold text-rose-700 hover:underline"
                        onClick={() => setLines((rows) => rows.filter((x) => x.id !== line.id))}
                      >
                        Remove line
                      </button>
                    </div>
                  ) : null}
                  {v && p ? (
                    <p className="md:col-span-12 text-xs text-black/45">
                      Catalog: {formatUsd(effectiveUnitCents(p, v))} · variant SKU {v.sku || "—"}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
          <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">Totals</p>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
              Adjustments
            </h2>
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Order status</span>
              <select className={INPUT} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/[0.07] bg-[#fffafb]/80 px-4 py-3">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-black/20"
                checked={decrementStock}
                onChange={(e) => setDecrementStock(e.target.checked)}
              />
              <span className="text-sm font-semibold text-[color:var(--charcoal)]">Decrement inventory</span>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Discount ($)</span>
              <input
                className={INPUT}
                inputMode="decimal"
                value={discountDollars}
                onChange={(e) => setDiscountDollars(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Tax ($)</span>
              <input
                className={INPUT}
                inputMode="decimal"
                value={taxDollars}
                onChange={(e) => setTaxDollars(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-semibold">Shipping ($)</span>
              <input
                className={INPUT}
                inputMode="decimal"
                value={shippingDollars}
                onChange={(e) => setShippingDollars(e.target.value)}
                placeholder="0"
              />
            </label>

            <div className="sm:col-span-2 rounded-2xl border border-black/[0.06] bg-[#fdf5fa]/80 px-4 py-4">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-black/55">Subtotal</span>
                <span className="font-semibold">{formatUsd(subtotalCents)}</span>
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-black/55">Total</span>
                <span className="font-[family-name:var(--font-display)] text-xl font-semibold text-[color:var(--charcoal)]">
                  {formatUsd(totalCents)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {submitError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {submitError}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting || !!loadError}
            className="h-12 min-w-[10rem] rounded-full bg-[color:var(--gold)] px-8 text-sm font-semibold text-[color:var(--charcoal)] shadow-[0_6px_24px_rgba(212,175,55,0.38)] disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create order"}
          </button>
          <Link
            href="/admin/orders"
            className="inline-flex h-12 items-center rounded-full border border-black/10 px-6 text-sm font-semibold text-black/70"
          >
            Cancel
          </Link>
        </div>
      </form>
    </AdminShell>
  );
}
