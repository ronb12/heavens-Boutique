"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { formatUsd } from "@/lib/money";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useStoreSettings } from "@/components/StoreSettingsProvider";

const PRESETS = [
  { label: "$25", cents: 2500 },
  { label: "$50", cents: 5000 },
  { label: "$100", cents: 10000 },
  { label: "$250", cents: 25000 },
];

async function getStripePk(): Promise<string> {
  const r = await apiFetch<{ publishableKey: string }>("/api/stripe-publishable", { auth: false });
  return String(r.publishableKey || "");
}

type IntentBody = {
  amountCents: number;
  sendAsGift: boolean;
  recipientEmail?: string;
  purchaserEmail?: string;
  message?: string;
};

async function createGiftCardIntent(body: IntentBody) {
  return apiFetch<{ clientSecret: string; amountCents: number }>("/api/payments/gift-card-purchase-intent", {
    method: "POST",
    body: JSON.stringify(body),
    auth: true,
  });
}

function GiftPaymentSection({
  clientSecret,
  amountCents,
  onStaleIntent,
}: {
  clientSecret: string;
  amountCents: number;
  /** PaymentIntent was canceled or is unusable — parent should clear `clientSecret` and ask user to continue again. */
  onStaleIntent: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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

  if (done) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white/85 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
          ✓
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[color:var(--charcoal)]">
          Gift card ordered
        </h2>
        <p className="mt-3 text-sm text-black/65 leading-relaxed">
          Payment succeeded. We emailed the gift card code to the delivery address you chose. Keep your Stripe receipt —
          check spam if needed.
        </p>
        <Link
          href="/shop"
          className="mt-8 inline-flex px-8 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm">
      <div className="font-semibold text-lg">Payment</div>
      <div className="mt-4">
        <PaymentElement />
      </div>
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#d4af37]/25 bg-[#fdfaf4] px-4 py-3 text-[color:var(--charcoal)]">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-semibold tabular-nums">{formatUsd(amountCents)}</span>
      </div>
      {error ? <div className="mt-4 text-sm text-rose-700 font-semibold">{error}</div> : null}
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
            setDone(true);
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Payment failed");
          } finally {
            setSubmitting(false);
          }
        }}
        className="mt-6 h-12 w-full rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
      >
        {submitting ? "Processing…" : `Pay ${formatUsd(amountCents)}`}
      </button>
    </div>
  );
}

export function GiftCardPurchaseClient() {
  const { giftCardsPurchaseEnabled, loading: settingsLoading } = useStoreSettings();
  const { user, loading } = useAuth();
  const [amountCents, setAmountCents] = useState(5000);
  const [customAmount, setCustomAmount] = useState("");
  const [sendAsGift, setSendAsGift] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [message, setMessage] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [intentAmount, setIntentAmount] = useState(0);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onStalePaymentIntent = useCallback(() => {
    setClientSecret("");
    setError(
      "That checkout session had already been closed. Your details are still here — tap Continue to payment for a fresh secure form.",
    );
  }, []);

  useEffect(() => {
    let m = true;
    (async () => {
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

  useEffect(() => {
    if (!settingsLoading && !giftCardsPurchaseEnabled && clientSecret) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear a stale payment intent when settings disable gift cards.
      setClientSecret("");
      setError(null);
    }
  }, [settingsLoading, giftCardsPurchaseEnabled, clientSecret]);

  const resolvedCents = useMemo(() => {
    const t = customAmount.trim();
    if (t) {
      const n = Number(t.replace(/[^0-9.]/g, ""));
      if (Number.isFinite(n) && n > 0) return Math.round(n * 100);
    }
    return amountCents;
  }, [amountCents, customAmount]);

  if (!settingsLoading && !giftCardsPurchaseEnabled) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader active="gift-cards" />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-14 sm:py-20">
          <nav className="mb-6 text-sm text-black/55">
            <Link href="/" className="font-semibold text-[color:var(--gold)] no-underline">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-black/75">Gift cards</span>
          </nav>
          <section className="rounded-3xl border border-black/10 bg-white/80 p-7 shadow-sm sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">Gift cards</p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold text-[color:var(--charcoal)] sm:text-4xl">
              Gift cards are not available yet
            </h1>
            <p className="mt-4 max-w-xl leading-relaxed text-black/60">
              Online gift cards are currently turned off while the store finishes setup. You can still shop the latest
              boutique finds or save items to your wishlist.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="inline-flex rounded-full bg-[color:var(--gold)] px-7 py-3 font-semibold text-[color:var(--charcoal)] no-underline"
              >
                Shop now
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
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="gift-cards" />

      <main className="mx-auto max-w-3xl px-4 py-12 flex-1 w-full">
        <nav className="text-sm text-black/55 mb-6">
          <Link href="/" className="text-[color:var(--gold)] font-semibold no-underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-black/75">Gift cards</span>
        </nav>

        <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-semibold text-[color:var(--charcoal)]">
          Buy a gift card
        </h1>
        <p className="mt-3 text-black/60 max-w-xl leading-relaxed">
          Load any amount (from $10 up to $500 by default), pay securely with Stripe, and we email the redemption code.
          Keep it for yourself or send it as a gift with a personal note.
        </p>

        {clientSecret ? (
          stripePromise ? (
            <div className="mt-10">
              <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
                <GiftPaymentSection
                  clientSecret={clientSecret}
                  amountCents={intentAmount}
                  onStaleIntent={onStalePaymentIntent}
                />
              </Elements>
              <button
                type="button"
                className="mt-6 text-sm font-semibold text-[color:var(--gold)] underline-offset-2 hover:underline bg-transparent border-0 cursor-pointer p-0"
                onClick={() => {
                  setClientSecret("");
                  setError(null);
                }}
              >
                ← Edit details
              </button>
            </div>
          ) : (
            <div className="mt-10 text-black/55">Loading payment form…</div>
          )
        ) : settingsLoading ? (
          <div className="mt-10 text-black/55">Checking availability…</div>
        ) : (
          <div className="mt-10 rounded-3xl border border-black/10 bg-white/80 p-6 md:p-8 shadow-sm space-y-8">
            <div>
              <div className="text-sm font-semibold text-[color:var(--charcoal)]">Amount</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.cents}
                    type="button"
                    onClick={() => {
                      setAmountCents(p.cents);
                      setCustomAmount("");
                    }}
                    className={[
                      "px-5 py-2.5 rounded-full text-sm font-semibold transition",
                      !customAmount.trim() && amountCents === p.cents
                        ? "bg-[color:var(--gold)] text-[color:var(--charcoal)] shadow"
                        : "border border-black/10 bg-white hover:bg-white/90",
                    ].join(" ")}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <label className="mt-4 grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Custom (USD)</span>
                <input
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="e.g. 75"
                  inputMode="decimal"
                  className="h-11 max-w-xs rounded-2xl border border-black/10 bg-white px-4"
                />
                <span className="text-xs text-black/50">
                  If filled, this overrides the preset. Charged total:{" "}
                  <span className="font-semibold text-black/75">{formatUsd(resolvedCents)}</span>
                </span>
              </label>
            </div>

            <div className="rounded-2xl border border-black/10 bg-[#fdfaf7] p-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendAsGift}
                  onChange={(e) => setSendAsGift(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold text-[color:var(--charcoal)]">Send as a gift</span>
                  <span className="block text-sm text-black/55 mt-1">
                    We email the gift card code to the recipient. You receive a payment receipt.
                  </span>
                </span>
              </label>

              {sendAsGift ? (
                <div className="mt-5 grid gap-4 pl-7 border-l-2 border-[color:var(--gold)]/40">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Recipient email</span>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                      placeholder="friend@email.com"
                      required={sendAsGift}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Optional message</span>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      maxLength={500}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                      placeholder="Happy birthday — treat yourself to something lovely."
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">
                {loading ? "Email" : user ? "Receipt email (your account)" : "Your email (receipt)"}
              </span>
              <input
                type="email"
                value={user?.email || purchaserEmail}
                onChange={(e) => setPurchaserEmail(e.target.value)}
                disabled={Boolean(user?.email)}
                className="h-11 rounded-2xl border border-black/10 bg-white px-4 disabled:opacity-70"
                placeholder="you@email.com"
                required
              />
              {user?.email ? (
                <span className="text-xs text-black/50">Signed in — receipt goes to your account email.</span>
              ) : null}
            </label>

            {error ? <div className="text-sm text-rose-700 font-semibold">{error}</div> : null}

            <button
              type="button"
              disabled={busy || loading}
              onClick={async () => {
                setError(null);
                const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
                if (sendAsGift && !emailOk(recipientEmail)) {
                  setError("Enter a valid recipient email.");
                  return;
                }
                if (!user?.email && !emailOk(purchaserEmail)) {
                  setError("Enter a valid email for your receipt.");
                  return;
                }
                setBusy(true);
                try {
                  const cents = resolvedCents;
                  const body: IntentBody = {
                    amountCents: cents,
                    sendAsGift,
                    message: message.trim() || undefined,
                  };
                  if (!user?.email) body.purchaserEmail = purchaserEmail.trim();
                  if (sendAsGift) body.recipientEmail = recipientEmail.trim();

                  const r = await createGiftCardIntent(body);
                  setClientSecret(r.clientSecret);
                  setIntentAmount(r.amountCents ?? cents);
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Could not start payment");
                } finally {
                  setBusy(false);
                }
              }}
              className="h-12 w-full rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
            >
              {busy ? "Starting…" : "Continue to payment"}
            </button>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
