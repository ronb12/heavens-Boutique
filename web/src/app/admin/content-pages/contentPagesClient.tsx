"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";

type Item = {
  id: string;
  slug: string;
  title: string;
  body: string;
  excerpt: string | null;
  kind: "page" | "blog";
  published: boolean;
};

export function ContentPagesAdminClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await apiFetch<{ items: Item[] }>("/api/admin/content-pages", { method: "GET" });
    setItems(r.items || []);
  };

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        await load();
      } catch (e: unknown) {
        if (m) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  return (
    <AdminShell title="Pages & journal">
      <p className="text-black/60 max-w-2xl">
        Edit policy pages and blog posts. Each item has a <strong>URL path</strong> (the last part of the web address), for example{" "}
        <code className="text-sm">yoursite.com/pages/shipping-policy</code> or <code className="text-sm">yoursite.com/blog/spring-edit</code>.
      </p>
      {error ? <div className="mt-4 text-sm text-rose-700 font-semibold">{error}</div> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="px-5 py-2.5 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold"
          onClick={() =>
            setEditing({
              id: "",
              slug: "",
              title: "",
              body: "",
              excerpt: "",
              kind: "page",
              published: false,
            })
          }
        >
          New page
        </button>
        <button
          type="button"
          className="px-5 py-2.5 rounded-full border border-black/10 bg-white font-semibold"
          onClick={() =>
            setEditing({
              id: "",
              slug: "",
              title: "",
              body: "",
              excerpt: "",
              kind: "blog",
              published: false,
            })
          }
        >
          New journal post
        </button>
      </div>

      {editing ? (
        <form
          className="mt-8 max-w-2xl grid gap-3 rounded-3xl border border-black/10 bg-white/80 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError(null);
            try {
              if (editing.id) {
                await apiFetch("/api/admin/content-pages", {
                  method: "PATCH",
                  body: JSON.stringify({
                    id: editing.id,
                    slug: editing.slug,
                    title: editing.title,
                    body: editing.body,
                    excerpt: editing.excerpt || null,
                    kind: editing.kind,
                    published: editing.published,
                  }),
                });
              } else {
                await apiFetch("/api/admin/content-pages", {
                  method: "POST",
                  body: JSON.stringify({
                    slug: editing.slug,
                    title: editing.title,
                    body: editing.body,
                    excerpt: editing.excerpt || null,
                    kind: editing.kind,
                    published: editing.published,
                  }),
                });
              }
              setEditing(null);
              await load();
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : "Save failed");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="font-semibold">{editing.id ? "Edit" : "Create"}</div>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">URL path</span>
            <span className="text-xs text-black/50">
              Lowercase words separated by hyphens — this becomes the link shoppers use (no spaces or special characters).
            </span>
            <input
              value={editing.slug}
              onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4"
              placeholder="shipping-policy"
              required={!editing.id}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Title</span>
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4"
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Excerpt (optional)</span>
            <input
              value={editing.excerpt || ""}
              onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Body (paragraphs separated by blank lines)</span>
            <textarea
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              className="min-h-48 rounded-2xl border border-black/10 px-4 py-3"
              required
            />
          </label>
          <label className="flex items-center gap-2 font-semibold text-sm">
            <input
              type="checkbox"
              checked={editing.published}
              onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
            />
            Published
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="h-11 px-6 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="h-11 px-6 rounded-full border border-black/10 bg-white font-semibold" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-10 grid gap-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="rounded-2xl border border-black/10 bg-white/80 p-4 flex flex-wrap justify-between gap-2 items-start"
          >
            <div>
              <div className="font-semibold">{it.title}</div>
              <div className="text-sm text-black/55">
                {it.kind === "blog" ? "/blog/" : "/pages/"}
                {it.slug} · {it.published ? "live" : "draft"}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="text-sm font-semibold text-[color:var(--gold)]" onClick={() => setEditing(it)}>
                Edit
              </button>
              <button
                type="button"
                className="text-sm font-semibold text-rose-700"
                onClick={async () => {
                  if (!window.confirm("Delete this page?")) return;
                  await apiFetch(`/api/admin/content-pages?id=${encodeURIComponent(it.id)}`, { method: "DELETE" });
                  await load();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link href="/admin" className="font-semibold text-[color:var(--gold)] no-underline">
          ← Admin home
        </Link>
      </div>
    </AdminShell>
  );
}
