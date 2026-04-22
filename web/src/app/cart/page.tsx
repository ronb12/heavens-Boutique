import { SiteHeader } from "@/components/SiteHeader";
import { CartClient } from "./cartClient";

export default function CartPage() {
  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="cart" />

      <main className="mx-auto max-w-6xl px-4 py-12 flex-1">
        <h1 className="text-3xl md:text-4xl">Cart</h1>
        <CartClient />
      </main>
    </div>
  );
}

