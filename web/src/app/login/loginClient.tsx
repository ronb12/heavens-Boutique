"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { SiteHeader } from "@/components/SiteHeader";

export function LoginClient({ next }: { next: string }) {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const wantsAdmin = next.startsWith("/admin");

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <h1 className="text-3xl">Sign in</h1>
        <p className="mt-2 text-black/60">Access your account, orders, and saved addresses.</p>

        <form
          className="mt-8 rounded-3xl border border-black/10 bg-white/80 p-6 grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              const r = await apiFetch<{
                token: string;
                user?: { role?: string };
              }>("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
                auth: false,
              });
              const role = String(r.user?.role || "");
              if (wantsAdmin && role && role !== "admin") {
                setError(
                  "That account signed in successfully, but it is not an admin account. Use your admin email (the one configured in ADMIN_EMAILS), or ask the owner to add your email to ADMIN_EMAILS in Vercel.",
                );
                return;
              }
              await signIn(String(r.token || ""));
              router.push(next);
              router.refresh();
            } catch (e2: any) {
              setError(e2?.message || "Sign in failed");
            } finally {
              setLoading(false);
            }
          }}
        >
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
              autoComplete="current-password"
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
              required
            />
          </label>

          {error ? <div className="text-sm text-rose-700 font-semibold">{error}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-12 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="text-sm text-black/60">
            New here?{" "}
            <Link
              href={`/register?next=${encodeURIComponent(next)}`}
              className="font-semibold text-[color:var(--gold)]"
            >
              Create an account
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}

