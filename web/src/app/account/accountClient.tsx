"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { AccountSubNav } from "@/components/AccountSubNav";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type Me = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: "admin" | "customer";
  loyaltyPoints: number;
  addresses: {
    id: string;
    label: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postal: string;
    country: string;
    isDefault: boolean;
  }[];
};

export function AccountClient() {
  const { user, loading, signOut, refresh } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setMe(null);
      if (!user) return;
      try {
        const r = await apiFetch<Me>("/api/users/me", { method: "GET" });
        if (mounted) setMe(r);
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load account");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-black/60">Loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="mx-auto max-w-4xl flex-1 px-4 py-12">
          <h1 className="text-3xl">Account</h1>
          <p className="mt-2 text-black/60">Sign in to see orders, addresses, and loyalty points.</p>
          <div className="mt-6">
            <Link
              href="/login?next=%2Faccount"
              className="inline-flex px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
            >
              Sign in
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="account" />

      <main className="mx-auto max-w-4xl px-4 py-12 flex-1">
        <AccountSubNav />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl">Account</h1>
            <p className="mt-2 text-black/60">{user.fullName || user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={async () => {
                await refresh();
              }}
              className="px-4 py-2 rounded-full border border-black/10 bg-white/70 font-semibold"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                signOut();
              }}
              className="px-4 py-2 rounded-full border border-black/10 bg-white/70 font-semibold"
            >
              Sign out
            </button>
          </div>
        </div>

        {error ? <div className="mt-6 text-sm text-rose-700 font-semibold">{error}</div> : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
            <div className="font-semibold text-lg">Loyalty points</div>
            <div className="mt-2 text-black/60">{me?.loyaltyPoints ?? user.loyaltyPoints ?? 0} points</div>
          </div>
          <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
            <div className="font-semibold text-lg">Role</div>
            <div className="mt-2 text-black/60">{user.role}</div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/returns"
            className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          >
            <div className="font-semibold text-lg text-[color:var(--foreground)]">Returns</div>
            <div className="mt-2 text-sm text-black/60">Start or track a return for items you have purchased.</div>
          </Link>
          <Link
            href="/account/profile"
            className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          >
            <div className="font-semibold text-lg text-[color:var(--foreground)]">Profile & security</div>
            <div className="mt-2 text-sm text-black/60">Update your name, email, phone, and password.</div>
          </Link>
          <Link
            href="/account/addresses"
            className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          >
            <div className="font-semibold text-lg text-[color:var(--foreground)]">Addresses</div>
            <div className="mt-2 text-sm text-black/60">Add, edit, remove, and choose a default address.</div>
          </Link>
          <Link
            href="/account/payment-methods"
            className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          >
            <div className="font-semibold text-lg text-[color:var(--foreground)]">Secure payments</div>
            <div className="mt-2 text-sm text-black/60">How we use Stripe — card details are entered at checkout, not stored on your profile.</div>
          </Link>
          <Link
            href="/messages"
            className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          >
            <div className="font-semibold text-lg text-[color:var(--foreground)]">Messages</div>
            <div className="mt-2 text-sm text-black/60">Store conversations and support threads.</div>
          </Link>
          <Link
            href="/wishlist"
            className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          >
            <div className="font-semibold text-lg text-[color:var(--foreground)]">Wishlist</div>
            <div className="mt-2 text-sm text-black/60">See everything you’ve saved.</div>
          </Link>
        </div>

        <div className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-2xl">Addresses</div>
              <div className="mt-1 text-black/60">Saved shipping addresses.</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {(me?.addresses || []).length ? (
              (me?.addresses || []).map((a) => (
                <div key={a.id} className="rounded-3xl border border-black/10 bg-white/80 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{a.label || "Address"}</div>
                    {a.isDefault ? (
                      <span className="text-xs font-semibold rounded-full bg-[color:var(--soft-pink)] px-3 py-1">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm text-black/60">
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}, {a.city}
                    {a.state ? `, ${a.state}` : ""} {a.postal} · {a.country}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-black/60">
                No saved addresses yet.
              </div>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

