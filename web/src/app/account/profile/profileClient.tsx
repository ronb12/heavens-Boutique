"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { AccountSubNav } from "@/components/AccountSubNav";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

type Me = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: "admin" | "customer";
};

export function ProfileClient() {
  const { user, loading, signOut, refresh } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        const r = await apiFetch<Me>("/api/users/me", { method: "GET" });
        if (!mounted) return;
        setMe(r);
        setFullName(r.fullName || "");
        setEmail(r.email || "");
        setPhone(r.phone || "");
      } catch (e: unknown) {
        if (mounted) setError(errMsg(e, "Failed to load profile"));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

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
          <h1 className="text-3xl">Profile</h1>
          <p className="mt-2 text-black/60">Sign in to edit your profile.</p>
          <div className="mt-6">
            <Link
              href="/login?next=%2Faccount%2Fprofile"
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
          <h1 className="text-3xl">Profile & security</h1>
          <p className="mt-2 text-black/60">Signed in as {user.email}</p>
        </div>

        {error ? <div className="mt-6 text-sm text-rose-700 font-semibold">{error}</div> : null}
        {saved ? <div className="mt-6 text-sm text-emerald-700 font-semibold">{saved}</div> : null}

        <form
          className="mt-8 rounded-3xl border border-black/10 bg-white/80 p-6 grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError(null);
            setSaved(null);
            try {
              const body: Record<string, unknown> = {};
              if ((me?.fullName || "") !== fullName) body.fullName = fullName;
              if ((me?.email || "") !== email) body.email = email;
              if ((me?.phone || "") !== phone) body.phone = phone.trim() ? phone.trim() : null;
              if (newPassword.trim()) body.newPassword = newPassword.trim();
              if (newPassword.trim() && currentPassword.trim()) body.currentPassword = currentPassword.trim();

              if (Object.keys(body).length === 0) {
                setSaved("Nothing to update.");
                return;
              }

              await apiFetch("/api/users/me", { method: "PATCH", body: JSON.stringify(body) });
              setSaved("Saved.");
              setCurrentPassword("");
              setNewPassword("");
              await refresh();
              const r = await apiFetch<Me>("/api/users/me", { method: "GET" });
              setMe(r);
            } catch (err: unknown) {
              setError(errMsg(err, "Save failed"));
            } finally {
              setSaving(false);
            }
          }}
        >
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
              autoComplete="email"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Phone (optional)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
              autoComplete="tel"
            />
          </label>

          <div className="pt-2 border-t border-black/10 grid gap-4">
            <div className="text-sm text-black/60">
              Password changes require your current password if your account already has one.
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Current password (if changing password)</span>
              <input
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type="password"
                className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                autoComplete="current-password"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">New password (optional)</span>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                autoComplete="new-password"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 h-12 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        <div className="mt-10 rounded-3xl border border-black/10 bg-white/80 p-6">
          <div className="font-semibold text-lg">Danger zone</div>
          <p className="mt-2 text-sm text-black/60">
            Deleting your account removes your profile from our system. This cannot be undone.
          </p>
          <button
            type="button"
            className="mt-4 h-11 px-5 rounded-full border border-rose-300 bg-white text-rose-800 font-semibold"
            onClick={async () => {
              const ok = window.confirm("Delete your account permanently?");
              if (!ok) return;
              setError(null);
              try {
                await apiFetch("/api/users/me", { method: "DELETE" });
                signOut();
                window.location.href = "/";
              } catch (e: unknown) {
                setError(errMsg(e, "Delete failed"));
              }
            }}
          >
            Delete account
          </button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
