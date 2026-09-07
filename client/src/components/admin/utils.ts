import { formatDistanceToNowStrict } from "date-fns";
import type { UserRole } from "@shared/auth-contracts";
import { dateFnsLocale, getActiveLanguage, intlLocale, translate } from "@/lib/i18n";

function tr(key: string, vars?: Record<string, string | number>): string {
  return translate(getActiveLanguage(), key, vars);
}

// Getter statt fester Strings, damit die Labels der aktiven Sprache folgen.
export const ROLE_LABELS: Record<UserRole, string> = {
  get admin() { return tr("admin.role.admin"); },
  get user() { return tr("admin.role.user"); },
};

export function roleLabel(role: string | null | undefined): string {
  return role && role in ROLE_LABELS ? ROLE_LABELS[role as UserRole] : role || "–";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleString(intlLocale(getActiveLanguage()));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleDateString(intlLocale(getActiveLanguage()));
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: dateFnsLocale(getActiveLanguage()) });
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "–";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toLocaleString(intlLocale(getActiveLanguage()), { maximumFractionDigits: 1 })} s`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return value.toLocaleString(intlLocale(getActiveLanguage()));
}

export function truncate(text: string | null | undefined, max = 90): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// apiRequest wirft Error mit Message "<status>: <body>".
export function parseApiError(error: unknown): { status: number | null; message: string } {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const match = raw.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!match) return { status: null, message: raw || tr("admin.unknownError") };
  const status = Number(match[1]);
  let message = match[2].trim();
  try {
    const parsed = JSON.parse(message) as { error?: unknown; message?: unknown };
    if (typeof parsed?.error === "string") message = parsed.error;
    else if (typeof parsed?.message === "string") message = parsed.message;
  } catch {
    // Body ist kein JSON, Text unverändert verwenden.
  }
  return { status, message: message || tr("admin.errorWithStatus", { status }) };
}

export function userLabel(displayName: string | null | undefined, username: string | null | undefined): string {
  if (displayName && username && displayName !== username) return `${displayName} (${username})`;
  return displayName || username || tr("admin.unknownUser");
}
