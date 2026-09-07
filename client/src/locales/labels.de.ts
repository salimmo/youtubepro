// Anzeige-Labels für englische Vertragswerte (Deutsch). Schlüssel: labels.<map>.<Enum-Wert>.
const dictionary: Record<string, string> = {
  "labels.difficulty.Easy": "Leicht",
  "labels.difficulty.Medium": "Mittel",
  "labels.difficulty.Hard": "Schwer",
  "labels.difficulty.Advanced": "Fortgeschritten",

  "labels.ideaFormat.YouTube Short": "YouTube Short",
  "labels.ideaFormat.Tutorial": "Tutorial",
  "labels.ideaFormat.Review": "Review",
  "labels.ideaFormat.Vlog": "Vlog",
  "labels.ideaFormat.Long-form": "Langform",

  "labels.evidenceClass.observed": "Beobachtet",
  "labels.evidenceClass.inferred": "Abgeleitet",
  "labels.evidenceClass.requires_studio": "Erfordert YouTube Studio",

  "labels.confidence.low": "Niedrig",
  "labels.confidence.medium": "Mittel",
  "labels.confidence.high": "Hoch",

  "labels.enrichmentStage.search": "Suche",
  "labels.enrichmentStage.video_details": "Videodetails",
  "labels.enrichmentStage.channel_enrichment": "Kanal-Anreicherung",

  "labels.enrichmentStatus.complete": "Vollständig",
  "labels.enrichmentStatus.partial": "Teilweise",
  "labels.enrichmentStatus.skipped": "Übersprungen",

  "labels.discoverySurface.search": "Suche",
  "labels.discoverySurface.browse": "Startseite/Browse",
  "labels.discoverySurface.suggested": "Vorgeschlagene Videos",
  "labels.discoverySurface.shorts_feed": "Shorts-Feed",
  "labels.discoverySurface.mixed": "Gemischt",
};

export default dictionary;
