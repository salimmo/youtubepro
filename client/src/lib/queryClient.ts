import { QueryClient, QueryFunction } from "@tanstack/react-query";

const UNAUTHORIZED_EVENT = "yp:unauthorized";
// Für diese Pfade kein globales Abmelde-Event auslösen (sonst Endlosschleife).
const UNAUTHORIZED_EVENT_EXCLUDED_PATHS = ["/api/auth/me", "/api/auth/login"];

function notifyUnauthorized(url: string) {
  let pathname = url;
  try {
    pathname = new URL(url, window.location.origin).pathname;
  } catch {
    // Ungültige URL: Rohwert vergleichen.
  }
  if (UNAUTHORIZED_EVENT_EXCLUDED_PATHS.includes(pathname)) return;
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

// Antworten von Zwischensystemen (Proxy, Firewall, Bot-Schutz) sind oft
// HTML-Seiten statt JSON. Die sollen nicht als Rohtext angezeigt werden.
function describeNonJsonBody(status: number, text: string): string | null {
  const trimmed = text.trim();
  if (!/^<!doctype html|^<html|^<head|^<body/i.test(trimmed)) return null;
  const title = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(trimmed)?.[1]?.trim();
  return JSON.stringify({
    error: `Der Server war nicht erreichbar (Status ${status}).`,
    suggestion: "Statt einer API-Antwort kam eine HTML-Fehlerseite, vermutlich von einem Proxy, einer Firewall oder einem Bot-Schutz zwischen Browser und Server. Versuche es erneut und prüfe, ob ein VPN, Firmennetz oder Filter aktiv ist.",
    detail: title ? `Seitentitel: ${title}` : "HTML-Seite ohne Titel",
    category: status >= 500 ? "provider_server" : "unknown",
    retryable: true,
  });
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) notifyUnauthorized(res.url);
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${describeNonJsonBody(res.status, text) ?? text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<unknown> {
  const headers: Record<string, string> = {};

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(url, {
      credentials: "include",
    });

    if (res.status === 401) {
      notifyUnauthorized(url);
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      throw new Error("Nicht autorisierte Anfrage.");
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
