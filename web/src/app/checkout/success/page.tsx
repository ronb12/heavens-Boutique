import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="orders" />
      <main className="mx-auto max-w-lg flex-1 px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold text-[color:var(--charcoal)]">Thank you</h1>
        <p className="mt-3 text-black/60">
          Your payment was processed. We will send a confirmation email when your order is on its way.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/orders"
            className="inline-flex justify-center rounded-full bg-[color:var(--gold)] px-6 py-3 font-semibold text-[color:var(--charcoal)] no-underline"
          >
            View orders
          </Link>
          <Link
            href="/shop"
            className="inline-flex justify-center rounded-full border border-black/10 bg-white/80 px-6 py-3 font-semibold no-underline"
          >
            Keep shopping
          </Link>
        </div>
      </main>
    </div>
  );
}
