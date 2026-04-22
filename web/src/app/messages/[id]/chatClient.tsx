"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";

type Msg = {
  id: string;
  senderId: string;
  senderName?: string | null;
  body: string | null;
  createdAt: string;
};

export function ChatClient({ id }: { id: string }) {
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const r = await apiFetch<{ messages: Msg[] }>(`/api/conversations/${encodeURIComponent(id)}/messages`, {
      method: "GET",
    });
    setMessages(r.messages || []);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        await load();
        if (mounted) setError(null);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load messages");
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (loading) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="messages" />
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-black/60">Loading…</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="messages" />
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
          <h1 className="text-3xl">Chat</h1>
          <p className="mt-2 text-black/60">Sign in to view messages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="messages" />
      <div className="sticky top-16 z-40 border-b border-black/5 bg-[color:var(--background)]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/messages" className="font-semibold text-[color:var(--gold)] no-underline">
            ← Messages
          </Link>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white/70 px-4 py-2 font-semibold"
            onClick={async () => {
              if (!confirm("Clear all messages in this conversation?")) return;
              setError(null);
              try {
                await apiFetch(`/api/conversations/${encodeURIComponent(id)}/messages`, { method: "DELETE" });
                setMessages([]);
              } catch (e: any) {
                setError(e?.message || "Failed to clear messages");
              }
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8 flex-1 w-full">
        {error ? <div className="mb-4 text-sm text-rose-700 font-semibold">{error}</div> : null}

        <div className="grid gap-3">
          {messages.map((m) => {
            const mine = m.senderId === user.id;
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={[
                    "max-w-[85%] rounded-3xl px-4 py-3 border",
                    mine
                      ? "bg-[color:var(--soft-pink)] border-black/10 text-[color:var(--charcoal)]"
                      : "bg-white border-black/10 text-black/70",
                  ].join(" ")}
                >
                  <div className="text-sm leading-6 whitespace-pre-wrap">{m.body || ""}</div>
                  <div className="mt-2 text-[11px] text-black/45">
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="border-t border-black/5 bg-[color:var(--background)]/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4 flex gap-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message…"
            className="h-12 flex-1 rounded-2xl border border-black/10 bg-white px-4"
          />
          <button
            type="button"
            disabled={sending || !draft.trim()}
            className="h-12 px-6 rounded-2xl bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
            onClick={async () => {
              const text = draft.trim();
              if (!text) return;
              setSending(true);
              setError(null);
              try {
                await apiFetch(`/api/conversations/${encodeURIComponent(id)}/messages`, {
                  method: "POST",
                  body: JSON.stringify({ body: text }),
                });
                setDraft("");
                await load();
              } catch (e: any) {
                setError(e?.message || "Failed to send");
              } finally {
                setSending(false);
              }
            }}
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}

