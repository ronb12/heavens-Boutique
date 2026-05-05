"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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

async function createOrderPaymentIntent(args: {
  items: { variantId: string; quantity: number }[];
  email?: string;
  promoCode?: string;
  giftCardCode?: string;
  shippingAddress: ShippingAddress;
  shippingTier: string;
  redeemPoints?: number;
}) {
  return await apiFetch<IntentResponse>("/api/payments/intent", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

function OrderPaymentPanel({
  clientSecret,
  amountCents,
  onStaleIntent,
  onSucceeded,
}: {
  clientSecret: string;
  amountCents: number;
  onStaleIntent: () => void;
  onSucceeded: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stripe || !clientSecret) return;
    let alive = true;
    void (async () => {
      try {
        const { error: retrieveErr, paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
        if (!alive || retrieveErr) return;
        if (paymentIntent?.status === "canceled") {
          onStaleIntent();
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [stripe, clientSecret, onStaleIntent]);

  return (
    <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5">
      <div className="font-semibold text-lg">Payment</div>
      <p className="mt-1 text-sm text-black/55">Card and wallets (Apple Pay, Google Pay when available) — all on this page.</p>
      <div className="mt-4">
        <PaymentElement />
      </div>
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#d4af37]/25 bg-[#fdfaf4] px-4 py-3 text-[color:var(--charcoal)]">
        <span className="font-semibold">Charged now</span>
        <span className="text-xl font-semibold tabular-nums">{formatUsd(amountCents)}</span>
      </div>
      {error ? <div className="mt-4 text-sm font-semibold text-rose-700">{error}</div> : null}
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
              redirect: "if_required",
            });
            if (result.error) {
              const pi = result.error.payment_intent;
              const piStatus =
                pi && typeof pi === "object" && pi !== null && "status" in pi
                  ? String((pi as { status?: string }).status || "")
                  : "";
              if (piStatus === "canceled" || /cancell?ed/i.test(result.error.message || "")) {
                onStaleIntent();
                return;
              }
              throw new Error(result.error.message || "Payment failed");
            }
            onSucceeded();
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Payment failed");
          } finally {
            setSubmitting(false);
          }
        }}
        className="mt-6 h-12 w-full rounded-full bg-[color:var(--gold)] font-semibold text-[color:var(--charcoal)] disabled:opacity-60"
      >
        {submitting ? "Processing…" : `Pay ${formatUsd(amountCents)}`}
      </button>
    </div>
  );
}

export function CheckoutClient() {
  const router = useRouter();
  const { items, revalidatePrices, clear } = useCart();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const showCancelled = searchParams.get("cancelled") === "1";

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
  const cartFingerprint = useMemo(() => JSON.stringify(lineItems), [lineItems]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0), [items]);

  useEffect(() => {
    if (!items.length) return;
    void revalidatePrices();
  }, [revalidatePrices, items.length]);

  const countryCode = coerceCountryCode(addr.country);
  const isUS = countryCode === "US";
  const countrySelectOptions = useMemo(() => {
    const base = [...COUNTRY_OPTIONS];
    if (countryCode && !base.some((c) => c.value === countryCode)) {
      return [{ value: countryCode, label: `${countryCode} (saved)` }, ...base];
    }
    return base;
  }, [countryCode]);

  const [clientSecret, setClientSecret] = useState("");
  const [intentAmountCents, setIntentAmountCents] = useState(0);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentLocked = Boolean(clientSecret);

  const onStalePaymentIntent = useCallback(() => {
    setClientSecret("");
    setError(
      "That payment session had already been closed. Your details are still here — tap Continue to secure payment for a fresh form.",
    );
  }, []);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const pk = await getStripePk();
        if (pk && m) setStripePromise(loadStripe(pk));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  const addrFingerprint = useMemo(
    () =>
      JSON.stringify({
        name: addr.name,
        line1: addr.line1,
        line2: addr.line2,
        city: addr.city,
        state: addr.state,
        postal: addr.postal,
        country: addr.country,
      }),
    [addr.name, addr.line1, addr.line2, addr.city, addr.state, addr.postal, addr.country],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cart/address changes invalidate the existing Stripe intent.
    setClientSecret("");
  }, [cartFingerprint, shippingTier, promoCode, giftCardCode, redeemPoints, email, user?.id, addrFingerprint]);

  if (!items.length) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader active="cart" />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-14">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[color:var(--charcoal)] sm:text-4xl">
            Checkout
          </h1>
          <section className="mt-6 rounded-3xl border border-black/10 bg-white/80 p-7 shadow-sm sm:p-10">
            <p className="font-semibold text-[color:var(--charcoal)]">Your cart is empty.</p>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-black/60">
              Add a piece to your cart before checking out. Saved something already? Your wishlist is a good place to
              pick back up.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="inline-flex rounded-full bg-[color:var(--gold)] px-7 py-3 font-semibold text-[color:var(--charcoal)] no-underline"
              >
                Start shopping
              </Link>
              <Link
                href="/wishlist"
                className="inline-flex rounded-full border border-black/10 bg-white px-7 py-3 font-semibold text-[color:var(--charcoal)] no-underline"
              >
                View wishlist
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  function isValidEmail(s: string) {
    const t = s.trim();
    return t.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  }

  return (
    <div className="flex min-h-full flex-col">
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

      <main className="mx-auto max-w-6xl flex-1 px-4 py-12">
        <h1 className="text-3xl md:text-4xl">Checkout</h1>
        <p className="mt-2 text-black/60">
          Secure payment with Stripe — pay on this page with card or digital wallets. Some banks may open a short verification step.
        </p>

        {showCancelled ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            You didn&apos;t finish payment last time. Your cart is still here — review details and continue when you&apos;re
            ready.
          </div>
        ) : null}

        <div className="mt-8 grid items-start gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
            <div className="text-lg font-semibold">Shipping & order</div>

            {!user ? (
              <label className="mt-4 grid gap-2">
                <span className="text-sm font-semibold">Email (receipt + updates)</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  disabled={paymentLocked}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4 disabled:opacity-60"
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
                  disabled={paymentLocked}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4 disabled:opacity-60"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Street address</span>
                <input
                  value={addr.line1}
                  onChange={(e) => setAddr((a) => ({ ...a, line1: e.target.value }))}
                  disabled={paymentLocked}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4 disabled:opacity-60"
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Apt / suite</span>
                <input
                  value={addr.line2 || ""}
                  onChange={(e) => setAddr((a) => ({ ...a, line2: e.target.value }))}
                  disabled={paymentLocked}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4 disabled:opacity-60"
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
                  disabled={paymentLocked}
                  className={`${SELECT_FIELD_CLASS} disabled:opacity-60`}
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
                    disabled={paymentLocked}
                    className="h-11 rounded-2xl border border-black/10 bg-white px-4 disabled:opacity-60"
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">{isUS ? "State" : "State / region"}</span>
                  {isUS ? (
                    <select
                      value={coerceUsStateCode(addr.state ?? "")}
                      onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value }))}
                      disabled={paymentLocked}
                      className={`${SELECT_FIELD_CLASS} disabled:opacity-60`}
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
                      disabled={paymentLocked}
                      className="h-11 rounded-2xl border border-black/10 bg-white px-4 disabled:opacity-60"
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
                  disabled={paymentLocked}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4 disabled:opacity-60"
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
                  disabled={paymentLocked}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4 disabled:opacity-60"
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
                  disabled={paymentLocked}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4 disabled:opacity-60"
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="mt-4">
              <GiftCardCheckoutPanel
                value={giftCardCode}
                onChange={setGiftCardCode}
                disabled={paymentLocked}
              />
            </div>

            {user ? (
              <label className="mt-4 grid gap-2">
                <span className="text-sm font-semibold">Redeem loyalty points (1 point = $0.01)</span>
                <input
                  value={String(redeemPoints || 0)}
                  onChange={(e) => setRedeemPoints(Number(e.target.value || 0))}
                  type="number"
                  min={0}
                  disabled={paymentLocked}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4 disabled:opacity-60"
                />
                <span className="text-xs text-black/55">Available: {user.loyaltyPoints ?? 0} points.</span>
              </label>
            ) : null}

            <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/70">
              <div className="flex items-center justify-between">
                <span>Cart subtotal</span>
                <span className="font-semibold">{formatUsd(subtotal)}</span>
              </div>
            </div>

            {error ? <div className="mt-4 text-sm font-semibold text-rose-700">{error}</div> : null}

            {paymentLocked ? (
              <button
                type="button"
                onClick={() => {
                  setClientSecret("");
                  setError(null);
                }}
                className="mt-4 w-full rounded-full border border-black/15 bg-white py-3 text-sm font-semibold text-black/80"
              >
                Edit shipping & discounts
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !stripePromise}
                onClick={async () => {
                  setError(null);
                  if (!user && !isValidEmail(email)) {
                    setError("Enter a valid email for your receipt and order updates.");
                    return;
                  }
                  const shipCountry = coerceCountryCode(addr.country);
                  const shipState =
                    shipCountry === "US" ? coerceUsStateCode(addr.state ?? "") || undefined : addr.state?.trim() || undefined;
                  const line1 = addr.line1.trim();
                  const city = addr.city.trim();
                  const postal = addr.postal.trim();
                  if (!line1 || !city || !postal) {
                    setError("Add a complete shipping address.");
                    return;
                  }
                  setBusy(true);
                  try {
                    const r = await createOrderPaymentIntent({
                      items: lineItems,
                      email: user ? undefined : email.trim(),
                      promoCode: promoCode || undefined,
                      giftCardCode: giftCardCode.trim() || undefined,
                      shippingAddress: {
                        ...addr,
                        country: shipCountry,
                        state: shipState,
                      },
                      shippingTier,
                      redeemPoints: user ? redeemPoints : undefined,
                    });
                    if (!r.clientSecret) {
                      setError("Could not start payment. Try again.");
                      return;
                    }
                    setIntentAmountCents(r.amountCents);
                    setClientSecret(r.clientSecret);
                  } catch (e: unknown) {
                    const msg =
                      e && typeof e === "object" && "message" in e
                        ? String((e as { message: string }).message)
                        : "Unable to start checkout";
                    setError(msg);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="mt-6 h-12 w-full rounded-full bg-[color:var(--gold)] font-semibold text-[color:var(--charcoal)] disabled:opacity-60"
              >
                {busy ? "Preparing secure payment…" : "Continue to secure payment"}
              </button>
            )}

            {clientSecret && stripePromise ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <OrderPaymentPanel
                  clientSecret={clientSecret}
                  amountCents={intentAmountCents}
                  onStaleIntent={onStalePaymentIntent}
                  onSucceeded={() => {
                    clear();
                    router.push("/checkout/success");
                  }}
                />
              </Elements>
            ) : null}
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
            <div className="text-lg font-semibold">How checkout works</div>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-black/70">
              <li>Enter your shipping address and any promo or gift card on this page.</li>
              <li>
                Tap <strong>Continue to secure payment</strong>, then complete card or wallet payment in the Stripe section
                — you stay on our site.
              </li>
              <li>
                When payment succeeds, we&apos;ll email your receipt. Signed-in customers can view orders under{" "}
                <Link href="/orders" className="font-semibold text-[color:var(--gold)] underline">
                  Orders
                </Link>
                .
              </li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
