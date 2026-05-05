"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabClass = (active: boolean) =>
  [
    "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold no-underline transition",
    active
      ? "bg-[color:var(--gold)] text-[color:var(--charcoal)] shadow"
      : "border border-black/10 bg-white/80 text-[color:var(--foreground)] hover:bg-white",
  ].join(" ");

export function AccountSubNav() {
  const pathname = usePathname() ?? "";
  const accountActive = pathname === "/account" || pathname.startsWith("/account/");
  const ordersActive = pathname === "/orders" || pathname.startsWith("/orders/");

  return (
    <nav className="mb-8 flex flex-wrap gap-2" aria-label="Account sections">
      <Link href="/account" className={tabClass(accountActive && !ordersActive)}>
        Account
      </Link>
      <Link href="/orders" className={tabClass(ordersActive)}>
        Orders
      </Link>
    </nav>
  );
}
