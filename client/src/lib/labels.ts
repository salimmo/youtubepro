// Anzeige-Labels für Vertragswerte, die in den Zod-Schemas bewusst auf
// Englisch bleiben (Gemini gibt sie so zurück, Tests prüfen sie so).
// Die Werte selbst dürfen nicht übersetzt werden, nur ihre Anzeige.
//
// Die Maps sind Proxys: jeder Zugriff liefert den Text in der aktuell
// aktiven Oberflächensprache (Wörterbücher: locales/labels.<de|en>.ts,
// Schlüssel "labels.<map>.<Enum-Wert>"). Aufrufer benutzen sie weiterhin wie
// gewöhnliche Record<string, string>.

import { getActiveLanguage, translate } from "@/lib/i18n";

function labelMap(group: string, keys: readonly string[]): Record<string, string> {
  const known = new Set<string>(keys);
  const resolve = (key: string) => translate(getActiveLanguage(), `labels.${group}.${key}`);
  return new Proxy<Record<string, string>>({}, {
    get(_target, property) {
      if (typeof property !== "string" || !known.has(property)) return undefined;
      return resolve(property);
    },
    has(_target, property) {
      return typeof property === "string" && known.has(property);
    },
    ownKeys() {
      return [...keys];
    },
    getOwnPropertyDescriptor(_target, property) {
      if (typeof property !== "string" || !known.has(property)) return undefined;
      return { enumerable: true, configurable: true, writable: false, value: resolve(property) };
    },
  });
}

export const DIFFICULTY_LABELS: Record<string, string> = labelMap("difficulty", [
  "Easy",
  "Medium",
  "Hard",
  "Advanced",
]);

export const IDEA_FORMAT_LABELS: Record<string, string> = labelMap("ideaFormat", [
  "YouTube Short",
  "Tutorial",
  "Review",
  "Vlog",
  "Long-form",
]);

export const EVIDENCE_CLASS_LABELS: Record<string, string> = labelMap("evidenceClass", [
  "observed",
  "inferred",
  "requires_studio",
]);

export const CONFIDENCE_LABELS: Record<string, string> = labelMap("confidence", [
  "low",
  "medium",
  "high",
]);

export const ENRICHMENT_STAGE_LABELS: Record<string, string> = labelMap("enrichmentStage", [
  "search",
  "video_details",
  "channel_enrichment",
]);

export const ENRICHMENT_STATUS_LABELS: Record<string, string> = labelMap("enrichmentStatus", [
  "complete",
  "partial",
  "skipped",
]);

export function labelFor(map: Record<string, string>, value: string | undefined | null): string {
  if (!value) return "";
  return map[value] ?? value;
}

export const DISCOVERY_SURFACE_LABELS: Record<string, string> = labelMap("discoverySurface", [
  "search",
  "browse",
  "suggested",
  "shorts_feed",
  "mixed",
]);
