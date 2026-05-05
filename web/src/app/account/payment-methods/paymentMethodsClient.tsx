"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { AccountSubNav } from "@/components/AccountSubNav";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export function PaymentMethodsClient() {
  const { user, loading } = useAuth();

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
          <h1 className="text-3xl">Secure payments</h1>
          <p className="mt-2 text-black/60">Sign in to see account settings.</p>
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
        <AccountSubNav />
        <div>
          <h1 className="text-3xl">Secure payments</h1>
          <p className="mt-2 text-black/60">We do not keep your card on file in this app.</p>
        </div>

        <div className="mt-8 rounded-3xl border border-black/10 bg-white/80 p-6 text-black/75 leading-relaxed">
          <p>
            You enter payment details in Stripe’s secure checkout (web) or the payment step when you complete a purchase
            in the app. We never store your full card number; Stripe handles the payment and only shares what we need for
            receipts and order support (for example, last four digits and brand when Stripe provides them for a
            successful charge).
          </p>
          <p className="mt-4">There is no “save card to my account” step, so you add your payment method at checkout each time you pay.</p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
