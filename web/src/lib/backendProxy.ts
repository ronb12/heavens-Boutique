import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Base URL for the deployed Node API (`.../api`), same sources as SSR (`BACKEND_PROXY_ORIGIN` or `NEXT_PUBLIC_API_BASE_URL`).
 */
export function getUpstreamApiBase(): string | null {
  const backend = process.env.BACKEND_PROXY_ORIGIN?.trim().replace(/\/+$/, "");
  if (backend) return `${backend}/api`;

  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (pub) return pub;

  return null;
}

/** Forward a POST JSON body to `${upstreamApiBase}/${path}` — path like `auth/login`. */
export async function proxyPostToApi(req: NextRequest, path: string): Promise<NextResponse> {
  const base = getUpstreamApiBase();
  if (!base) {
    return NextResponse.json(
      {
        error:
          "Store API is not configured. Set BACKEND_PROXY_ORIGIN or NEXT_PUBLIC_API_BASE_URL on this project.",
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
