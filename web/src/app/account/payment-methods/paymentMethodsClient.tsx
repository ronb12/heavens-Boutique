"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

type Method = { id: string; brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null };

async function getStripePk(): Promise<string> {
  const r = await apiFetch<{ publishableKey: string }>("/api/stripe-publishable", { auth: false });
  return String(r.publishableKey || "");
}

function AddCardForm({ clientSecret, onDone }: { clientSecret: string; onDone: () => Promise<void> | void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
      <div className="font-semibold text-lg">Add a card</div>
      <div className="mt-4">
        <PaymentElement />
      </div>
      {error ? <div className="mt-4 text-sm text-rose-700 font-semibold">{error}</div> : null}
      {ok ? <div className="mt-4 text-sm text-emerald-700 font-semibold">Card saved.</div> : null}

      <button
        type="button"
        disabled={busy || !stripe || !elements}
        className="mt-6 h-12 w-full rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            const result = await stripe!.confirmSetup({
              elements: elements!,
              clientSecret,
              redirect: "if_required",
            });
            if (result.error) throw new Error(result.error.message || "Setup failed");
            setOk(true);
            await onDone();
          } catch (e: unknown) {
            setError(errMsg(e, "Setup failed"));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "Save card"}
      </button>
    </div>
  );
}

export function PaymentMethodsClient() {
  const { user, loading } = useAuth();
  const [methods, setMethods] = useState<Method[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string>("");

  const reloadMethods = async () => {
    const r = await apiFetch<{ methods: Method[] }>("/api/payments/methods", { method: "GET" });
    setMethods(r.methods || []);
  };

  const bootstrapSetupIntent = async () => {
    const r = await apiFetch<{ clientSecret: string }>("/api/payments/setup-intent", { method: "POST", body: "{}" });
    setClientSecret(String(r.clientSecret || ""));
  };

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        await reloadMethods();
        await bootstrapSetupIntent();
      } catch (e: unknown) {
        if (mounted) setError(errMsg(e, "Failed to load payment methods"));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const appearance = useMemo(
    () => ({
      theme: "stripe" as const,
      variables: {
        colorPrimary: "#111827",
      },
    }),
    [],
  );

  if (loading) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="account" />
        <main className="mx-auto max-w-3xl px-4 py-12 flex-1 text-black/60">Loading…</main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="account" />
        <main className="mx-auto max-w-3xl px-4 py-12 flex-1">
          <h1 className="text-3xl">Saved cards</h1>
          <p className="mt-2 text-black/60">Sign in to manage saved payment methods.</p>
          <div className="mt-6">
            <Link
              href="/login?next=%2Faccount%2Fpayment-methods"
              className="inline-flex px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
            >
              Sign in
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="account" />

      <main className="mx-auto max-w-3xl px-4 py-10 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl">Saved cards</h1>
            <p className="mt-2 text-black/60">Securely saved with Stripe for faster checkout.</p>
          </div>
          <Link href="/account" className="font-semibold text-[color:var(--gold)] no-underline">
            ← Account
          </Link>
        </div>

        {error ? <div className="mt-6 text-sm text-rose-700 font-semibold">{error}</div> : null}

        <div className="mt-8 grid gap-4">
          {methods.length ? (
            methods.map((m) => (
              <div key={m.id} className="rounded-3xl border border-black/10 bg-white/80 p-6 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold">
                    {(m.brand || "Card").toUpperCase()} ·••• {m.last4 || "????"}
                  </div>
                  <div className="mt-1 text-sm text-black/60">
                    {m.expMonth && m.expYear ? `Expires ${m.expMonth}/${m.expYear}` : "Saved card"}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  className="px-5 py-2.5 rounded-full border border-black/10 bg-white font-semibold disabled:opacity-60"
                  onClick={async () => {
                    const ok = window.confirm("Remove this card?");
                    if (!ok) return;
                    setBusyId(m.id);
                    setError(null);
                    try {
                      await apiFetch(`/api/payments/methods?id=${encodeURIComponent(m.id)}`, { method: "DELETE" });
                      await reloadMethods();
                    } catch (e: unknown) {
                      setError(errMsg(e, "Remove failed"));
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-black/60">No saved cards yet.</div>
          )}
        </div>

        <div className="mt-8">
          {stripePromise && clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
              <AddCardForm
                clientSecret={clientSecret}
                onDone={async () => {
                  await reloadMethods();
                  await bootstrapSetupIntent();
                }}
              />
            </Elements>
          ) : (
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-black/60">
              Payments aren’t configured yet (missing Stripe publishable key or setup intent).
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
