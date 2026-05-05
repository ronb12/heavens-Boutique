import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/backendOrigin";

/** Base URL for the deployed Node API (`.../api`). */
export function getUpstreamApiBase(): string | null {
  return resolveUpstreamApiBase();
}

/** Forward a POST JSON body to `${upstreamApiBase}/${path}` — path like `auth/login`. */
export async function proxyPostToApi(req: NextRequest, path: string): Promise<NextResponse> {
  const base = getUpstreamApiBase();
  if (!base) {
    return NextResponse.json(
      {
        error:
          "Store API is not configured. Set BACKEND_PROXY_ORIGIN or NEXT_PUBLIC_API_BASE_URL on this Vercel project (Production + Preview), then redeploy.",
      },
      { status: 503 },
    );
  }

  const suffix = path.replace(/^\/+/, "");
  const url = `${base.replace(/\/+$/, "")}/${suffix}`;
  const body = await req.text();

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": req.headers.get("Content-Type") || "application/json",
    },
    body,
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: {
      "Content-Type": r.headers.get("Content-Type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}
