import { NextResponse } from "next/server";

function forwardHeaders(req: Request): Headers {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("Authorization", auth);
  return h;
}

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });

  const url = new URL(req.url);
  const upstreamUrl = `${base.replace(/\/+$/, "")}/api/payments/methods${url.search}`;
  const upstream = await fetch(upstreamUrl, { method: "GET", headers: forwardHeaders(req), cache: "no-store" });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}

export async function DELETE(req: Request) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });

  const url = new URL(req.url);
  const upstreamUrl = `${base.replace(/\/+$/, "")}/api/payments/methods${url.search}`;
  const upstream = await fetch(upstreamUrl, { method: "DELETE", headers: forwardHeaders(req), cache: "no-store" });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
