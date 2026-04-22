"use client";

export function track(event: string, props?: Record<string, unknown>) {
  try {
    // Always send to same-origin to avoid cross-origin CORS issues in production.
    const url = "/api/events";
    const payload = JSON.stringify({
      event,
      path: typeof window !== "undefined" ? window.location.pathname : null,
      props: props || {},
    });

    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

