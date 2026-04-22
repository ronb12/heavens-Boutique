"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";

type Conversation = {
  id: string;
  title: string;
  lastMessageAt: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
};

export function MessagesClient() {
  const { user, loading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      setError(null);
      try {
        const all = user.role === "admin" ? "?all=1" : "";
        const r = await apiFetch<{ conversations: Conversation[] }>(`/api/conversations${all}`, { method: "GET" });
        if (mounted) setConversations(r.conversations || []);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load conversations");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="messages" />
        <div className="mx-auto max-w-5xl flex-1 px-4 py-12 text-black/60">Loading…</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="messages" />
        <div className="mx-auto max-w-5xl flex-1 px-4 py-12">
          <h1 className="text-3xl">Messages</h1>
          <p className="mt-2 text-black/60">Sign in to view your conversations.</p>
          <div className="mt-6">
            <Link
              href="/login?next=%2Fmessages"
              className="inline-flex rounded-full bg-[color:var(--gold)] px-6 py-3 font-semibold text-[color:var(--charcoal)] no-underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="messages" />

      <main className="mx-auto max-w-5xl flex-1 px-4 py-12">
        <h1 className="text-3xl">Messages</h1>
        {error ? <div className="mt-6 text-sm text-rose-700 font-semibold">{error}</div> : null}

        <div className="mt-8 grid gap-3">
          {conversations.length ? (
            conversations.map((c) => (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className="block rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">{c.title || "Chat"}</div>
                    {user.role === "admin" ? (
                      <div className="mt-1 text-sm text-black/55">
                        {c.customerName || c.customerEmail || ""}
                      </div>
                    ) : null}
                    <div className="mt-1 text-sm text-black/55">
                      {c.lastMessageAt ? `Last message: ${new Date(c.lastMessageAt).toLocaleString()}` : "No messages yet"}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[color:var(--gold)]">Open →</div>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60">
              No conversations yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

