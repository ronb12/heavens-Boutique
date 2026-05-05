import { Suspense } from "react";
import { CheckoutClient } from "./checkoutClient";

function CheckoutFallback() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center text-black/55">Loading checkout…</div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutClient />
    </Suspense>
  );
}

