import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type PagePayload = {
  page: {
    slug: string;
    title: string;
    body: string;
    kind: string;
  };
};

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let data: PagePayload | null = null;
  try {
    data = await apiFetch<PagePayload>(`/api/pages?slug=${encodeURIComponent(slug)}`, { auth: false });
  } catch {
    data = null;
  }
  if (!data?.page || data.page.kind !== "blog") notFound();

  const paragraphs = (data.page.body || "").split(/\n\n+/).filter(Boolean);

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 flex-1">
        <div className="text-sm text-black/55">
          <Link href="/blog" className="text-[color:var(--gold)] font-semibold no-underline">
            Journal
          </Link>
          <span className="mx-2">/</span>
          <span>{data.page.title}</span>
        </div>
        <h1 className="mt-4 text-3xl md:text-4xl">{data.page.title}</h1>
        <div className="mt-8 space-y-4 text-black/70 leading-7">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
