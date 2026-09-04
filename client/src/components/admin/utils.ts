import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import type { UserRole } from "@shared/auth-contracts";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  user: "Benutzer",
};

export function roleLabel(role: string | null | undefined): string {
  return role && role in ROLE_LABELS ? ROLE_LABELS[role as UserRole] : role || "–";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleString("de-DE");
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleDateString("de-DE");
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: de });
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "–";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return value.toLocaleString("de-DE");
}

export function truncate(text: string | null | undefined, max = 90): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// apiRequest wirft Error mit Message "<status>: <body>".
export function parseApiError(error: unknown): { status: number | null; message: string } {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const match = raw.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!match) return { status: null, message: raw || "Unbekannter Fehler." };
  const status = Number(match[1]);
  let message = match[2].trim();
  try {
    const parsed = JSON.parse(message) as { error?: unknown; message?: unknown };
    if (typeof parsed?.error === "string") message = parsed.error;
    else if (typeof parsed?.message === "string") message = parsed.message;
  } catch {
    // Body ist kein JSON, Text unverändert verwenden.
  }
  return { status, message: message || `Fehler ${status}` };
}

export function userLabel(displayName: string | null | undefined, username: string | null | undefined): string {
  if (displayName && username && displayName !== username) return `${displayName} (${username})`;
  return displayName || username || "Unbekannt";
}
