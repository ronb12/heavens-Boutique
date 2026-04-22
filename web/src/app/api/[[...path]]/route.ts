import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Fallback proxy for `/api/*` paths that do not have a dedicated `route.ts`.
 * Needed when `next.config.ts` rewrites were not applied at build time (missing
 * `BACKEND_PROXY_ORIGIN` during `next build`) — otherwise `/api/admin/*` returns 404.
 */
function resolveUpstreamOrigin(): string | null {
  const backend = process.env.BACKEND_PROXY_ORIGIN?.trim().replace(/\/+$/, "");
  if (backend) return backend;

  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!pub) return null;
  if (pub.endsWith("/api")) return pub.slice(0, -4);
  return pub;
}

function buildTargetUrl(req: NextRequest, segments: string[]): string | null {
  const origin = resolveUpstreamOrigin();
  if (!origin) return null;
  const path = segments.length ? segments.join("/") : "";
  const base = `${origin.replace(/\/+$/, "")}/api/${path}`;
  const u = new URL(base);
  u.search = req.nextUrl.search;
  return u.toString();
}

function forwardHeaders(req: NextRequest): Headers {
  const h = new Headers();
  for (const name of ["accept", "authorization", "content-type", "cookie", "x-requested-with"]) {
    const v = req.headers.get(name);
    if (v) h.set(name, v);
  }
  return h;
}

async function proxy(req: NextRequest, segments: string[]) {
  const url = buildTargetUrl(req, segments);
  if (!url) {
    return NextResponse.json(
      {
        error:
          "Store API is not configured. Set BACKEND_PROXY_ORIGIN or NEXT_PUBLIC_API_BASE_URL on this project.",
      },
      { status: 503 }
    );
  }

  const method = req.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers: forwardHeaders(req),
    cache: "no-store",
  };

  if (!["GET", "HEAD"].includes(method) && method !== "OPTIONS") {
    init.body = await req.arrayBuffer();
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return NextResponse.json({ error: "Upstream API unreachable" }, { status: 502 });
  }

  const body = await res.arrayBuffer();
  const headers = new Headers(res.headers);
  headers.delete("transfer-encoding");
  return new NextResponse(body, { status: res.status, headers });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function OPTIONS(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}
