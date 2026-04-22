"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-lg w-full rounded-3xl border border-black/10 bg-white/80 p-8">
        <div className="hb-script text-3xl text-[color:var(--foreground)]">Heaven’s Boutique</div>
        <h1 className="mt-4 text-2xl">Page not found</h1>
        <p className="mt-2 text-black/60">That page doesn’t exist.</p>
        <div className="mt-6">
          <Link
            href="/shop"
            className="inline-flex px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
          >
            Shop
          </Link>
        </div>
      </div>
    </div>
  );
}

