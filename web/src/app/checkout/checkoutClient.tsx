"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { apiFetch } from "@/lib/api";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { formatUsd } from "@/lib/money";
import {
  COUNTRY_OPTIONS,
  US_STATE_OPTIONS,
  coerceCountryCode,
  coerceUsStateCode,
  SELECT_FIELD_CLASS,
} from "@/lib/formOptions";
import { GiftCardCheckoutPanel } from "@/components/GiftCardChrome";
import { SiteHeader } from "@/components/SiteHeader";

type ShippingAddress = {
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal: string;
  country?: string;
};

type IntentResponse = {
  clientSecret: string;
  amountCents: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  giftCardDebitCents?: number;
};

async function getStripePk(): Promise<string> {
  const r = await apiFetch<{ publishableKey: string }>("/api/stripe-publishable", { auth: false });
  return String(r.publishableKey || "");
}

async function createIntent(args: {
  items: { variantId: string; quantity: number }[];
  email?: string;
  promoCode?: string;
  giftCardCode?: string;
  shippingAddress: ShippingAddress;
  shippingTier: string;
  redeemPoints?: number;
}): Promise<IntentResponse> {
  return await apiFetch<IntentResponse>("/api/payments/intent", {
    method: "POST",
    body: JSON.stringify(args),
    auth: true,
  });
}

function CheckoutInner({
  clientSecret,
  totals,
}: {
  clientSecret: string;
  totals: IntentResponse;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  return (
    <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
      <div className="font-semibold text-lg">Payment</div>
      <div className="mt-4">
        <PaymentElement />
      </div>

      <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/70">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <span className="font-semibold">{formatUsd(totals.subtotalCents)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>Discount</span>
          <span className="font-semibold">-{formatUsd(totals.discountCents)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>Shipping</span>
          <span className="font-semibold">{formatUsd(totals.shippingCents)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>Tax</span>
          <span className="font-semibold">{formatUsd(totals.taxCents)}</span>
        </div>
        {(totals.giftCardDebitCents ?? 0) > 0 ? (
          <div className="mt-2 flex items-center justify-between rounded-xl border border-[color:var(--gold)]/35 bg-gradient-to-r from-[#2b2b2b] via-[#3d2530] to-[#1a1418] px-3 py-2.5 text-sm text-[#fdf2f6] shadow-[inset_0_1px_0_rgba(234,176,200,0.15)] ring-1 ring-[#eab0c8]/20">
            <span className="flex items-center gap-2 font-semibold">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-[color:var(--gold)] shadow-[0_0_10px_rgba(212,175,55,0.85)]"
                aria-hidden
              />
              Gift card
            </span>
            <span className="font-semibold tabular-nums text-[color:var(--gold-light)]">
              -{formatUsd(totals.giftCardDebitCents ?? 0)}
            </span>
          </div>
        ) : null}
        <div className="mt-3 pt-3 border-t border-black/10 flex items-center justify-between">
          <span>Total</span>
          <span className="font-semibold">{formatUsd(totals.amountCents)}</span>
        </div>
      </div>

      {error ? <div className="mt-4 text-sm text-rose-700 font-semibold">{error}</div> : null}
      {success ? (
        <div className="mt-4 text-sm font-semibold text-emerald-700">
          Payment confirmed. Thank you.
        </div>
      ) : null}

      <button
        type="button"
        disabled={submitting || !stripe || !elements}
        onClick={async () => {
          setError(null);
          setSubmitting(true);
          try {
            const result = await stripe!.confirmPayment({
              elements: elements!,
              clientSecret,
              confirmParams: {
                // No return_url so we can keep it simple for now.
              },
              redirect: "if_required",
            });
            if (result.error) throw new Error(result.error.message || "Payment failed");
            setSuccess(true);
            clear();
          } catch (e: any) {
            setError(e?.message || "Payment failed");
          } finally {
            setSubmitting(false);
          }
        }}
        className="mt-6 h-12 w-full rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
      >
        {submitting ? "Processing…" : "Pay now"}
      </button>
    </div>
  );
}

export function CheckoutClient() {
  const { items } = useCart();
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [shippingTier, setShippingTier] = useState("standard");
  const [redeemPoints, setRedeemPoints] = useState<number>(0);
  const [addr, setAddr] = useState<ShippingAddress>({
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal: "",
    country: "US",
  });

  const lineItems = useMemo(
    () => items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    [items],
  );

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0), [items]);

  const countryCode = coerceCountryCode(addr.country);
  const isUS = countryCode === "US";
  const countrySelectOptions = useMemo(() => {
    const base = [...COUNTRY_OPTIONS];
    if (countryCode && !base.some((c) => c.value === countryCode)) {
      return [{ value: countryCode, label: `${countryCode} (saved)` }, ...base];
    }
    return base;
  }, [countryCode]);

  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [totals, setTotals] = useState<IntentResponse | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const pk = await getStripePk();
        if (!pk) return;
        if (mounted) setStripePromise(loadStripe(pk));
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!items.length) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="cart" />
        <main className="mx-auto max-w-6xl px-4 py-12 flex-1">
          <h1 className="text-3xl">Checkout</h1>
          <div className="mt-6 rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60">
            Your cart is empty.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="cart" />
      {user ? (
        <div className="border-b border-black/5 bg-[color:var(--background)]/90">
          <p className="mx-auto max-w-6xl px-4 py-2 text-right text-sm text-black/60">{user.fullName || user.email}</p>
        </div>
      ) : (
        <div className="border-b border-black/5 bg-[color:var(--background)]/90">
          <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 py-2">
            <span className="text-sm text-black/55 sm:hidden">Have an account?</span>
            <Link
              href={`/login?next=${encodeURIComponent("/checkout")}`}
              className="rounded-full border border-black/10 bg-white/80 px-4 py-1.5 text-sm font-semibold no-underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-12 flex-1">
        <h1 className="text-3xl md:text-4xl">Checkout</h1>
        <p className="mt-2 text-black/60">Secure payment powered by Stripe.</p>

        <div className="mt-8 grid gap-4 lg:grid-cols-2 items-start">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
            <div className="font-semibold text-lg">Shipping</div>

            {!user ? (
              <label className="mt-4 grid gap-2">
                <span className="text-sm font-semibold">Email (receipt + updates)</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                  required
                />
              </label>
            ) : null}

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Full name</span>
                <input
                  value={addr.name || ""}
                  onChange={(e) => setAddr((a) => ({ ...a, name: e.target.value }))}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Street address</span>
                <input
                  value={addr.line1}
                  onChange={(e) => setAddr((a) => ({ ...a, line1: e.target.value }))}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Apt / suite</span>
                <input
                  value={addr.line2 || ""}
                  onChange={(e) => setAddr((a) => ({ ...a, line2: e.target.value }))}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Country</span>
                <select
                  value={countryCode}
                  onChange={(e) => {
                    const next = e.target.value;
                    setAddr((a) => ({
                      ...a,
                      country: next,
                      state:
                        next === "US"
                          ? coerceUsStateCode(a.state ?? "")
                          : (a.state ?? "").trim(),
                    }));
                  }}
                  className={SELECT_FIELD_CLASS}
                >
                  {countrySelectOptions.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">City</span>
                  <input
                    value={addr.city}
                    onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))}
                    className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">{isUS ? "State" : "State / region"}</span>
                  {isUS ? (
                    <select
                      value={coerceUsStateCode(addr.state ?? "")}
                      onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value }))}
                      className={SELECT_FIELD_CLASS}
                    >
                      <option value="">Select state</option>
                      {US_STATE_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={addr.state || ""}
                      onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value }))}
                      className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                      placeholder="Optional"
                    />
                  )}
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">ZIP / Postal</span>
                <input
                  value={addr.postal}
                  onChange={(e) => setAddr((a) => ({ ...a, postal: e.target.value }))}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                  required
                />
              </label>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Shipping tier</span>
                <select
                  value={shippingTier}
                  onChange={(e) => setShippingTier(e.target.value)}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                >
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                  <option value="priority">Priority</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Promo code</span>
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="mt-4">
              <GiftCardCheckoutPanel value={giftCardCode} onChange={setGiftCardCode} />
            </div>

            {user ? (
              <label className="mt-4 grid gap-2">
                <span className="text-sm font-semibold">Redeem loyalty points (1 point = $0.01)</span>
                <input
                  value={String(redeemPoints || 0)}
                  onChange={(e) => setRedeemPoints(Number(e.target.value || 0))}
                  type="number"
                  min={0}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                />
                <span className="text-xs text-black/55">
                  Available: {user.loyaltyPoints ?? 0} points.
                </span>
              </label>
            ) : null}

            <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/70">
              <div className="flex items-center justify-between">
                <span>Cart subtotal</span>
                <span className="font-semibold">{formatUsd(subtotal)}</span>
              </div>
            </div>

            {error ? <div className="mt-4 text-sm text-rose-700 font-semibold">{error}</div> : null}

            <button
              type="button"
              disabled={loadingIntent || !!clientSecret}
              onClick={async () => {
                setError(null);
                setLoadingIntent(true);
                try {
                  const shipCountry = coerceCountryCode(addr.country);
                  const shipState =
                    shipCountry === "US"
                      ? coerceUsStateCode(addr.state ?? "") || undefined
                      : addr.state?.trim() || undefined;
                  const intent = await createIntent({
                    items: lineItems,
                    email: user ? undefined : email,
                    promoCode: promoCode || null || undefined,
                    giftCardCode: giftCardCode.trim() || undefined,
                    shippingAddress: {
                      ...addr,
                      country: shipCountry,
                      state: shipState,
                    },
                    shippingTier,
                    redeemPoints: user ? redeemPoints : undefined,
                  });
                  setClientSecret(intent.clientSecret);
                  setTotals(intent);
                } catch (e: any) {
                  setError(e?.message || "Unable to start checkout");
                } finally {
                  setLoadingIntent(false);
                }
              }}
              className="mt-6 h-12 w-full rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
            >
              {clientSecret ? "Payment ready" : loadingIntent ? "Starting…" : "Continue to payment"}
            </button>
          </div>

          <div>
            {!clientSecret || !stripePromise || !totals ? (
              <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-black/60">
                Enter shipping info, then press “Continue to payment”.
              </div>
            ) : (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutInner clientSecret={clientSecret} totals={totals} />
              </Elements>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

