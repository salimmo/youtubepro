import type {
  IdeaPackage,
  ResearchInsightsResponse,
  SearchResponse,
  Video,
} from "@shared/schema";
import type { calculateYouTubeAnalytics } from "@/lib/youtube-analytics";
import {
  CONFIDENCE_LABELS,
  DIFFICULTY_LABELS,
  DISCOVERY_SURFACE_LABELS,
  ENRICHMENT_STATUS_LABELS,
  EVIDENCE_CLASS_LABELS,
  IDEA_FORMAT_LABELS,
  labelFor,
} from "@/lib/labels";

export type ResearchAnalytics = ReturnType<typeof calculateYouTubeAnalytics>;

export interface ResearchReportData {
  query: string;
  totalResults: number;
  totalResultsIsApproximate: boolean;
  resultsPerPage?: number;
  regionCode?: string;
  nextPageToken?: string;
  snapshotId: string;
  retrievedAt: string;
  filters: {
    uploadDate: string;
    duration: string;
    sortBy: string;
  };
  analytics: ResearchAnalytics;
  videos: Video[];
  insights: ResearchInsightsResponse;
  ideas: IdeaPackage[];
  provenance: SearchResponse["provenance"];
  enrichment: SearchResponse["enrichment"];
  warnings: SearchResponse["warnings"];
}

type Cell = string | number | boolean | null | undefined;

interface ExportTable {
  name: string;
  columns: string[];
  rows: Cell[][];
}

function readable(value: Cell): string {
  if (value === null || value === undefined || value === "") return "k. A.";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  return String(value);
}

function joined(values?: readonly string[]): string {
  return values && values.length > 0 ? values.join(" | ") : "k. A.";
}

function videoInteractionRate(video: Video): string {
  if (!video.viewCount || video.likeCount === undefined || video.commentCount === undefined) return "k. A.";
  return `${(((video.likeCount + video.commentCount) / video.viewCount) * 100).toFixed(2)}%`;
}

export function safeExportStem(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "recherche";
}

export function buildResearchExportTables(data: ResearchReportData): ExportTable[] {
  const { analytics, insights } = data;
  const summary: ExportTable = {
    name: "Zusammenfassung",
    columns: ["Feld", "Wert"],
    rows: [
      ["Bericht", "YouTube-Recherchebericht"],
      ["Suchbegriff", data.query],
      ["Abgerufen", data.retrievedAt],
      ["Snapshot-ID", data.snapshotId],
      ["Geschätzte passende Ergebnisse", data.totalResults],
      ["Ergebniszahl ist ungefähr", data.totalResultsIsApproximate],
      ["Ergebnisse pro Seite", data.resultsPerPage],
      ["Regionscode", data.regionCode],
      ["Token für nächste Seite", data.nextPageToken],
      ["Analysierte Videos", analytics.totalVideos],
      ["Eindeutige Kanäle", analytics.uniqueChannels],
      ["Aufrufe in der Stichprobe", analytics.totalViews],
      ["Durchschnittliche Aufrufe", analytics.avgViews],
      ["Median der Aufrufe", analytics.medianViews],
      ["Median der Aufrufe pro Tag", analytics.medianDailyViews],
      ["Sichtbare Interaktionsrate", analytics.avgEngagement === "N/A" ? "k. A." : `${analytics.avgEngagement}%`],
      ["Upload-Datum-Filter", data.filters.uploadDate],
      ["Dauer-Filter", data.filters.duration],
      ["Sortierung", data.filters.sortBy],
      ["Kurzfassung", insights.summary],
    ],
  };

  const overview: ExportTable = {
    name: "Überblick",
    columns: ["Abschnitt", "Bezeichnung", "Wert", "Definition"],
    rows: [
      ...analytics.durationData.map((item) => ["Dauer-Verteilung", item.name, item.value, "Zurückgegebene Videos"]),
      ...analytics.recencyData.map((item) => ["Aktualität der Veröffentlichung", item.name, item.value, "Zurückgegebene Videos"]),
      ...analytics.topTags.map((item) => ["Wiederkehrende Tags", item.label, item.count, "Verschiedene zurückgegebene Videos mit diesem öffentlichen Tag"]),
      ["Datenabdeckung", "Aufrufe", analytics.coverage.views, `von ${analytics.totalVideos}`],
      ["Datenabdeckung", "Vollständiges Engagement", analytics.coverage.engagement, `von ${analytics.totalVideos}`],
      ["Datenabdeckung", "Öffentliche Abonnenten", analytics.coverage.subscribers, `von ${analytics.totalVideos}`],
      ["Datenabdeckung", "Untertitel verfügbar", analytics.coverage.captions, `von ${analytics.totalVideos}`],
      ["Datenabdeckung", "Öffentliche Tags", analytics.coverage.tags, `von ${analytics.totalVideos}`],
      ["Datenabdeckung", "HD-Auflösung", analytics.coverage.hd, `von ${analytics.totalVideos}`],
      ...analytics.velocityLeaders.map(({ video, viewsPerDay }, index) => [
        "Momentum-Spitzenreiter",
        `${index + 1}. ${video.title}`,
        Math.round(viewsPerDay),
        "Altersbereinigte Aufrufe pro Tag, keine Echtzeit-Geschwindigkeit",
      ]),
      ...analytics.breakoutLeaders.map(({ video, viewsPerSubscriber }, index) => [
        "Breakout im Verhältnis zu Abonnenten",
        `${index + 1}. ${video.title}`,
        Number(viewsPerSubscriber.toFixed(2)),
        "Aufrufe geteilt durch die aktuelle gerundete öffentliche Abonnentenzahl",
      ]),
    ],
  };

  const videos: ExportTable = {
    name: "Videos",
    columns: [
      "Rang", "Video-ID", "Titel", "Kanal", "Kanal-ID", "Veröffentlicht", "Dauer",
      "Aufrufe", "Likes", "Kommentare", "Sichtbare Interaktionsrate", "Tags", "Kategorie-ID",
      "Live-Status", "Untertitel", "Auflösung", "Lizenzierter Inhalt", "Einbettbar",
      "Für Kinder", "Bezahlte Produktplatzierung", "Standardsprache", "Audiosprache",
      "Themenkategorien", "Live: tatsächlicher Start", "Live: tatsächliches Ende", "Live: geplanter Start",
      "Live: gleichzeitige Zuschauer", "Kanal-Abonnenten", "Abonnenten verborgen", "Kanal-Videos",
      "Kanal-Aufrufe", "Kanal erstellt", "Kanal-Land", "Kanal-Custom-URL",
      "Kanal-Standardsprache", "Kanal-Keywords", "Kanal-Themenkategorien",
      "Kanal-Thumbnail-URL", "Kanalbeschreibung", "Thumbnail-URL", "YouTube-URL", "Beschreibung",
    ],
    rows: data.videos.map((video, index) => [
      index + 1,
      video.id,
      video.title,
      video.channelTitle,
      video.channelId,
      video.publishedAt,
      video.duration,
      video.viewCount,
      video.likeCount,
      video.commentCount,
      videoInteractionRate(video),
      joined(video.tags),
      video.categoryId,
      video.liveBroadcastContent,
      video.hasCaptions,
      video.definition,
      video.licensedContent,
      video.embeddable,
      video.madeForKids,
      video.hasPaidProductPlacement,
      video.defaultLanguage,
      video.defaultAudioLanguage,
      joined(video.topicCategories),
      video.liveStreamingDetails?.actualStartTime,
      video.liveStreamingDetails?.actualEndTime,
      video.liveStreamingDetails?.scheduledStartTime,
      video.liveStreamingDetails?.concurrentViewers,
      video.channelStatistics?.subscriberCount,
      video.channelStatistics?.hiddenSubscriberCount,
      video.channelStatistics?.videoCount,
      video.channelStatistics?.viewCount,
      video.channelStatistics?.publishedAt,
      video.channelStatistics?.country,
      video.channelStatistics?.customUrl,
      video.channelStatistics?.defaultLanguage,
      video.channelStatistics?.keywords,
      joined(video.channelStatistics?.topicCategories),
      video.channelStatistics?.thumbnailUrl,
      video.channelStatistics?.description,
      video.thumbnailUrl,
      `https://www.youtube.com/watch?v=${video.id}`,
      video.description,
    ]),
  };

  const aiInsights: ExportTable = {
    name: "KI-Insights",
    columns: ["Abschnitt", "Element", "Detail"],
    rows: [
      ["Kurzfassung", "Zusammenfassung", insights.summary],
      ["Suchintention", "Primäre Intention", insights.queryIntent.primaryIntent],
      ["Suchintention", "Zuschauerbedürfnis", insights.queryIntent.viewerNeed],
      ["Suchintention", "Discovery-Oberfläche", insights.queryIntent.discoverySurface],
      ["Suchintention", "Glaubwürdigkeitshinweis", insights.queryIntent.credibilityNote],
      ...insights.evidenceSignals.observed.map((value, index) => ["Evidenz-Signale", `Beobachtet ${index + 1}`, value]),
      ...insights.evidenceSignals.inferred.map((value, index) => ["Evidenz-Signale", `Abgeleitet ${index + 1}`, value]),
      ...insights.evidenceSignals.requiresStudio.map((value, index) => ["Evidenz-Signale", `Erfordert Studio ${index + 1}`, value]),
      ...insights.peopleAlsoAsk.flatMap((item, index) => [
        ["Zuschauerfragen", `Frage ${index + 1}`, item.question],
        ["Zuschauerfragen", `Antwort ${index + 1}`, item.answer],
      ]),
      ["Zielgruppe", "Hypothese zur primären Demografie", insights.targetAudience.primaryDemographic],
      ["Zielgruppe", "Hypothese zur Altersspanne", insights.targetAudience.ageRange],
      ["Zielgruppe", "Interessen", joined(insights.targetAudience.interests)],
      ["Zielgruppe", "Schmerzpunkte", joined(insights.targetAudience.painPoints)],
      ["Zielgruppe", "Content-Präferenzen", joined(insights.targetAudience.contentPreferences)],
      ["Nische", "Wettbewerbsniveau", insights.nicheAnalysis.competitionLevel],
      ["Nische", "Wachstumstrend", insights.nicheAnalysis.growthTrend],
      ["Nische", "Hypothesen zu Veröffentlichungszeiten", joined(insights.nicheAnalysis.bestPostingTimes)],
      ["Nische", "Empfohlene Formate", joined(insights.nicheAnalysis.recommendedFormats)],
      ["Nische", "Monetarisierungshypothese", insights.nicheAnalysis.monetizationPotential],
      ...insights.contentGaps.map((value, index) => ["Content-Lücken", `Lücke ${index + 1}`, value]),
      ...insights.trendingSubtopics.map((value, index) => ["Unterthemen", `Unterthema ${index + 1}`, value]),
      ...insights.recommendedActions.flatMap((item, index) => [
        ["Empfohlene Maßnahmen", `Maßnahme ${index + 1}`, item.title],
        ["Empfohlene Maßnahmen", `Begründung ${index + 1}`, item.rationale],
        ["Empfohlene Maßnahmen", `Format ${index + 1}`, item.format],
      ]),
      ["Methodik", "Stichprobengröße", insights.methodology.sampleSize],
      ["Methodik", "Grundlage", insights.methodology.basis],
      ...insights.methodology.limitations.map((value, index) => ["Methodik", `Einschränkung ${index + 1}`, value]),
    ],
  };

  const evidence: ExportTable = {
    name: "Evidenz",
    columns: ["ID", "Klasse", "Aussage", "Konfidenz", "Quellvideo-IDs", "Einschränkungen", "Snapshot-ID"],
    rows: insights.evidenceClaims.map((claim) => [
      claim.id,
      labelFor(EVIDENCE_CLASS_LABELS, claim.evidenceClass),
      claim.claim,
      labelFor(CONFIDENCE_LABELS, claim.confidence),
      joined(claim.sourceVideoIds),
      joined(claim.limitations),
      claim.snapshotId,
    ]),
  };

  const ideas: ExportTable = {
    name: "Ideen",
    columns: [
      "Idee", "Titel", "Beschreibung", "Keywords", "Format", "Schwierigkeit", "Discovery-Oberfläche",
      "Ehrliches Versprechen", "Payoff", "Thumbnail-Konzept", "Studio-Metrik", "Experiment-Regel",
      "Evidenz-Aussage-IDs", "Quellvideo-IDs",
    ],
    rows: data.ideas.map((idea, index) => [
      index + 1,
      idea.title,
      idea.description,
      joined(idea.keywords),
      labelFor(IDEA_FORMAT_LABELS, idea.format),
      labelFor(DIFFICULTY_LABELS, idea.difficulty),
      labelFor(DISCOVERY_SURFACE_LABELS, idea.discoverySurface),
      idea.honestPromise,
      idea.payoff,
      idea.thumbnailConcept,
      idea.studioMetric,
      idea.experimentRule,
      joined(idea.evidenceClaims.map((claim) => claim.id)),
      joined(Array.from(new Set(idea.evidenceClaims.flatMap((claim) => claim.sourceVideoIds)))),
    ]),
  };

  const provenance: ExportTable = {
    name: "Abdeckung & Quellen",
    columns: ["Abschnitt", "Feld", "Wert"],
    rows: [
      ["Herkunft", "Anbieter", data.provenance.provider],
      ["Herkunft", "Suchbegriff", data.provenance.query],
      ["Herkunft", "Geordnete Video-IDs", joined(data.provenance.orderedVideoIds)],
      ...Object.entries(data.enrichment).flatMap(([stage, detail]) => [
        ["Anreicherung", `${stage}: Status`, labelFor(ENRICHMENT_STATUS_LABELS, detail.status)],
        ["Anreicherung", `${stage}: angefordert`, detail.requested],
        ["Anreicherung", `${stage}: zurückgegeben`, detail.returned],
      ]),
      ...data.warnings.map((warning, index) => [
        "Warnungen",
        `${index + 1}. ${warning.code}`,
        `${warning.stage}: ${warning.message}`,
      ]),
    ],
  };

  return [summary, overview, videos, aiInsights, evidence, ideas, provenance];
}

function csvCell(value: Cell): string {
  const text = readable(value).replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildResearchCsv(data: ResearchReportData): string {
  const rows: Cell[][] = [["Tabelle", "Zeile", "Feld", "Wert"]];
  for (const table of buildResearchExportTables(data)) {
    table.rows.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        rows.push([table.name, rowIndex + 1, table.columns[columnIndex], readable(value)]);
      });
    });
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function xml(value: Cell): string {
  return readable(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlCell(value: Cell, header = false): string {
  const numeric = typeof value === "number" && Number.isFinite(value);
  const style = header ? ' ss:StyleID="Header"' : "";
  return `<Cell${style}><Data ss:Type="${numeric ? "Number" : "String"}">${xml(value)}</Data></Cell>`;
}

export function buildResearchXls(data: ResearchReportData): string {
  const worksheets = buildResearchExportTables(data).map((table) => {
    const header = `<Row>${table.columns.map((column) => xmlCell(column, true)).join("")}</Row>`;
    const rows = table.rows.map((row) => `<Row>${row.map((value) => xmlCell(value)).join("")}</Row>`).join("");
    const columns = table.columns.map((column, index) => {
      const longest = Math.max(column.length, ...table.rows.slice(0, 100).map((row) => readable(row[index]).length));
      return `<Column ss:AutoFitWidth="0" ss:Width="${Math.min(320, Math.max(70, longest * 6))}"/>`;
    }).join("");
    return `<Worksheet ss:Name="${xml(table.name.slice(0, 31))}"><Table>${columns}${header}${rows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions></Worksheet>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Header"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#B9563F" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style></Styles>${worksheets}</Workbook>`;
}

function download(contents: BlobPart, mime: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadResearchCsv(data: ResearchReportData): void {
  download(
    buildResearchCsv(data),
    "text/csv;charset=utf-8",
    `youtube-recherche-${safeExportStem(data.query)}.csv`,
  );
}

export function downloadResearchXls(data: ResearchReportData): void {
  download(
    buildResearchXls(data),
    "application/vnd.ms-excel;charset=utf-8",
    `youtube-recherche-${safeExportStem(data.query)}.xls`,
  );
}
