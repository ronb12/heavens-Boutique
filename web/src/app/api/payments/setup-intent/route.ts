import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });

  const payload = await req.text();
  const h = new Headers();
  h.set("Content-Type", "application/json");
  const auth = req.headers.get("authorization");
  if (auth) h.set("Authorization", auth);

  const upstream = await fetch(`${base.replace(/\/+$/, "")}/api/payments/setup-intent`, {
    method: "POST",
    headers: h,
    body: payload,
    cache: "no-store",
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
