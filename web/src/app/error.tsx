"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-lg w-full rounded-3xl border border-black/10 bg-white/80 p-8">
        <div className="hb-script text-3xl text-[color:var(--foreground)]">Heaven’s Boutique</div>
        <h1 className="mt-4 text-2xl">Something went wrong</h1>
        <p className="mt-2 text-black/60">
          Try again. If it keeps happening, contact support and mention the time.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-6 py-3 rounded-full border border-black/10 bg-white/70 font-semibold no-underline"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

