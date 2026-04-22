"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { SiteHeader } from "@/components/SiteHeader";

export function RegisterClient({ next }: { next: string }) {
  const router = useRouter();
  const { signIn } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <h1 className="text-3xl">Create account</h1>
        <p className="mt-2 text-black/60">Checkout faster and keep your order history in one place.</p>

        <form
          className="mt-8 rounded-3xl border border-black/10 bg-white/80 p-6 grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              const r = await apiFetch<{ token: string } & Record<string, unknown>>("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({ email, password, fullName }),
                auth: false,
              });
              await signIn(String(r.token || ""));
              router.push(next);
              router.refresh();
            } catch (e2: any) {
              setError(e2?.message || "Registration failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              type="text"
              autoComplete="name"
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
              placeholder="Optional"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
              required
              minLength={8}
            />
            <span className="text-xs text-black/55">Minimum 8 characters.</span>
          </label>

          {error ? <div className="text-sm text-rose-700 font-semibold">{error}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-12 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create account"}
          </button>

          <div className="text-sm text-black/60">
            Already have an account?{" "}
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="font-semibold text-[color:var(--gold)]"
            >
              Sign in
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}

