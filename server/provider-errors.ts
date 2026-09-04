import type { ProviderErrorCategory, ProviderErrorResponse } from "@shared/schema";

export class ProviderError extends Error {
  readonly category: ProviderErrorCategory;
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(options: {
    message: string;
    category: ProviderErrorCategory;
    code: string;
    status: number;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "ProviderError";
    this.category = options.category;
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

type ProviderErrorContext = "youtube" | "gemini";

function categoryFromMessage(message: string): ProviderErrorCategory {
  const normalized = message.toLowerCase();
  if (normalized.includes("not configured") || normalized.includes("missing api key")) return "missing_key";
  if (
    normalized.includes("api key not valid")
    || normalized.includes("keyinvalid")
    || normalized.includes("invalid api key")
    || normalized.includes("api_key_invalid")
    || normalized.includes("permission_denied")
    || normalized.includes("authentication")
    || normalized.includes("unauthorized")
  ) return "invalid_key";
  if (
    normalized.includes("quota")
    || normalized.includes("ratelimit")
    || normalized.includes("rate limit")
    || normalized.includes("too many requests")
    || normalized.includes("daily limit")
    || normalized.includes("resource_exhausted")
  ) return "quota";
  if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("abort")) return "timeout";
  if (normalized.includes("network") || normalized.includes("fetch failed") || normalized.includes("econn")) return "network";
  if (normalized.includes("invalid response") || normalized.includes("malformed") || normalized.includes("schema")) return "invalid_response";
  return "unknown";
}

function defaultsForCategory(category: ProviderErrorCategory): Pick<ProviderError, "status" | "retryable"> {
  switch (category) {
    case "missing_key": return { status: 503, retryable: false };
    case "invalid_key": return { status: 401, retryable: false };
    case "quota": return { status: 429, retryable: true };
    case "timeout": return { status: 504, retryable: true };
    case "network":
    case "provider_server": return { status: 502, retryable: true };
    case "invalid_response": return { status: 502, retryable: false };
    default: return { status: 500, retryable: true };
  }
}

export function normalizeProviderError(error: unknown, context: ProviderErrorContext): ProviderError {
  if (error instanceof ProviderError) return error;

  const message = error instanceof Error ? error.message : String(error || "Unknown provider error");
  const category = categoryFromMessage(message);
  const defaults = defaultsForCategory(category);

  return new ProviderError({
    message,
    category,
    code: `${context.toUpperCase()}_${category.toUpperCase()}`,
    ...defaults,
    cause: error,
  });
}

export function providerErrorPayload(error: ProviderError, contextLabel: string): ProviderErrorResponse {
  const copy: Record<ProviderErrorCategory, { error: string; suggestion: string }> = {
    missing_key: {
      error: `${contextLabel} ist nicht konfiguriert`,
      suggestion: "Füge den API-Schlüssel des Anbieters in den Einstellungen hinzu und versuche es dann erneut.",
    },
    invalid_key: {
      error: `${contextLabel} hat den konfigurierten API-Schlüssel abgelehnt`,
      suggestion: "Ersetze den API-Schlüssel in den Einstellungen und prüfe seine Einschränkungen beim Anbieter.",
    },
    quota: {
      error: `Kontingent für ${contextLabel} nicht verfügbar`,
      suggestion: "Warte, bis das Kontingent zurückgesetzt wird, oder prüfe das Kontingent beim Anbieter, bevor du es erneut versuchst.",
    },
    timeout: {
      error: `Zeitüberschreitung bei ${contextLabel}`,
      suggestion: "Prüfe die Verbindung und versuche es erneut. Wiederholte Zeitüberschreitungen können auf eine Störung beim Anbieter hindeuten.",
    },
    network: {
      error: `${contextLabel} ist nicht erreichbar`,
      suggestion: "Prüfe die Netzwerkverbindung des Servers und versuche es erneut.",
    },
    provider_server: {
      error: `${contextLabel} hat einen Serverfehler zurückgegeben`,
      suggestion: "Versuche es nach einer kurzen Wartezeit erneut. Wenn das Problem anhält, prüfe die Statusseite des Anbieters.",
    },
    invalid_response: {
      error: `${contextLabel} hat eine ungültige Antwort zurückgegeben`,
      suggestion: "Versuche es einmal erneut. Wenn das Problem anhält, wähle ein anderes unterstütztes Modell oder melde den Fehler im Antwortformat.",
    },
    unknown: {
      error: `${contextLabel} ist auf ein Problem gestoßen`,
      suggestion: "Versuche es einmal erneut. Wenn das Problem anhält, prüfe die Server-Logs auf den Fehlercode des Anbieters.",
    },
  };

  return {
    ...copy[error.category],
    code: error.code,
    category: error.category,
    retryable: error.retryable,
  };
}
