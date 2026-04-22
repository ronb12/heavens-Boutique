import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type ListPayload = {
  posts: { slug: string; title: string; excerpt: string | null; publishedAt: string | null }[];
};

export default async function BlogIndexPage() {
  let posts: ListPayload["posts"] = [];
  try {
    const r = await apiFetch<ListPayload>("/api/pages", { auth: false });
    posts = r.posts || [];
  } catch {
    posts = [];
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 flex-1">
        <h1 className="text-3xl md:text-4xl">Journal</h1>
        <p className="mt-2 text-black/60">Updates, styling notes, and boutique news.</p>
        <div className="mt-8 grid gap-4">
          {posts.length ? (
            posts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="rounded-3xl border border-[color:var(--border-subtle)] bg-white/85 p-6 no-underline hover:shadow-sm transition-shadow"
              >
                <div className="font-semibold text-lg">{p.title}</div>
                {p.excerpt ? <div className="mt-2 text-sm text-black/60">{p.excerpt}</div> : null}
              </Link>
            ))
          ) : (
            <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60">
              No posts yet — check back soon.
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
