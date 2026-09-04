// Deutsche Anzeige-Labels für Vertragswerte, die in den Zod-Schemas bewusst
// auf Englisch bleiben (Gemini gibt sie so zurück, Tests prüfen sie so).
// Die Werte selbst dürfen nicht übersetzt werden, nur ihre Anzeige.

export const DIFFICULTY_LABELS: Record<string, string> = {
  Easy: "Leicht",
  Medium: "Mittel",
  Hard: "Schwer",
  Advanced: "Fortgeschritten",
};

export const IDEA_FORMAT_LABELS: Record<string, string> = {
  "YouTube Short": "YouTube Short",
  Tutorial: "Tutorial",
  Review: "Review",
  Vlog: "Vlog",
  "Long-form": "Langform",
};

export const EVIDENCE_CLASS_LABELS: Record<string, string> = {
  observed: "Beobachtet",
  inferred: "Abgeleitet",
  requires_studio: "Erfordert YouTube Studio",
};

export const CONFIDENCE_LABELS: Record<string, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
};

export const ENRICHMENT_STAGE_LABELS: Record<string, string> = {
  search: "Suche",
  video_details: "Videodetails",
  channel_enrichment: "Kanal-Anreicherung",
};

export const ENRICHMENT_STATUS_LABELS: Record<string, string> = {
  complete: "Vollständig",
  partial: "Teilweise",
  skipped: "Übersprungen",
};

export function labelFor(map: Record<string, string>, value: string | undefined | null): string {
  if (!value) return "";
  return map[value] ?? value;
}

export const DISCOVERY_SURFACE_LABELS: Record<string, string> = {
  search: "Suche",
  browse: "Startseite/Browse",
  suggested: "Vorgeschlagene Videos",
  shorts_feed: "Shorts-Feed",
  mixed: "Gemischt",
};
