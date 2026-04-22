import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const payload = await req.text();
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;

    // If no backend is configured, treat tracking as a no-op.
    if (!base) return new NextResponse(null, { status: 204 });

    const upstream = await fetch(`${base}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    // Don't block the UI on analytics; just acknowledge.
    if (!upstream.ok) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ ok: true });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

