import { getApiBaseUrl } from "@/lib/env";
import { getAuthToken } from "@/lib/authToken";
import { getServerSideApiBaseUrl } from "@/lib/serverOrigin";

export type ApiError = {
  status: number;
  message: string;
};

async function readErrorMessage(r: Response): Promise<string> {
  try {
    const data = (await r.json()) as { error?: string; message?: string };
    return data.error || data.message || r.statusText || "Request failed";
  } catch {
    return r.statusText || "Request failed";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { auth?: boolean; /** Default true in the browser — avoids cross-origin + CORS when NEXT_PUBLIC_API_BASE_URL points at the API host. */ sameOrigin?: boolean }
): Promise<T> {
  const isBrowser = typeof window !== "undefined";
  const pathNorm = path.startsWith("/") ? path : `/${path}`;
  const explicitBase = getApiBaseUrl().trim();
  const serverFallback = !isBrowser ? getServerSideApiBaseUrl().trim() : "";
  const base = explicitBase || serverFallback;
  const sameOrigin = init?.sameOrigin ?? isBrowser;

  const url =
    isBrowser && sameOrigin
      ? pathNorm
      : base
        ? `${base.replace(/\/+$/, "")}${pathNorm}`
        : pathNorm;

  const headers = new Headers(init?.headers || {});
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");

  const wantsAuth = init?.auth !== false;
  if (wantsAuth) {
    const token = getAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const r = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!r.ok) {
    throw { status: r.status, message: await readErrorMessage(r) } satisfies ApiError;
  }
  return (await r.json()) as T;
}

