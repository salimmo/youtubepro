import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";

// Anfragebezogener Kontext ohne Parameter-Durchreichen: aktuell nur die
// Oberflächensprache des Benutzers. Gemini-Prompts und Fehlertexte lesen sie
// hier aus, damit KI-Ausgaben und Meldungen zur gewählten Sprache passen.

export type UiLocale = "de" | "en";

interface RequestContext {
  locale: UiLocale;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function normalizeLocale(value: unknown): UiLocale | null {
  if (typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  if (lower.startsWith("de")) return "de";
  if (lower.startsWith("en")) return "en";
  return null;
}

export function currentLocale(): UiLocale {
  return storage.getStore()?.locale ?? "de";
}

// Sprachname für Gemini-Prompts (OUTPUT_LANGUAGE bleibt als globaler
// Standard für "de" erhalten, damit bestehende Deployments sich nicht ändern).
export function currentOutputLanguage(): string {
  const locale = currentLocale();
  if (locale === "en") return "English";
  return process.env.OUTPUT_LANGUAGE?.trim() || "German (Deutsch)";
}

// Priorität: explizite Benutzereinstellung (Session) > Header der Oberfläche
// > Accept-Language > Deutsch.
export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const fromUser = normalizeLocale((req.user as { locale?: string } | undefined)?.locale);
  const fromHeader = normalizeLocale(req.get("x-ui-language"));
  const fromAccept = normalizeLocale(req.get("accept-language")?.split(",")[0]);
  const locale = fromUser ?? fromHeader ?? fromAccept ?? "de";
  storage.run({ locale }, () => next());
}

export function runWithLocale<T>(locale: UiLocale, fn: () => T): T {
  return storage.run({ locale }, fn);
}
