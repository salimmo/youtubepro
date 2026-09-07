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
import { getActiveLanguage, translate, type TranslateVars } from "@/lib/i18n";

// Alle Überschriften, Tabellen- und Spaltennamen kommen aus
// locales/export.<de|en>.ts und folgen der aktiven Oberflächensprache.
const tx = (key: string, vars?: TranslateVars) => translate(getActiveLanguage(), `export.${key}`, vars);
const common = (key: string) => translate(getActiveLanguage(), `common.${key}`);

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
    language?: string;
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
  if (value === null || value === undefined || value === "") return common("notAvailable");
  if (typeof value === "boolean") return value ? common("yes") : common("no");
  return String(value);
}

function joined(values?: readonly string[]): string {
  return values && values.length > 0 ? values.join(" | ") : common("notAvailable");
}

// Verhältniswerte auf zwei Nachkommastellen; fehlende Baseline bleibt leer (k. A.).
function roundedMetric(value?: number, digits = 2): number | undefined {
  return value === undefined ? undefined : Number(value.toFixed(digits));
}

function videoInteractionRate(video: Video): string {
  if (!video.viewCount || video.likeCount === undefined || video.commentCount === undefined) return common("notAvailable");
  return `${(((video.likeCount + video.commentCount) / video.viewCount) * 100).toFixed(2)}%`;
}

export function safeExportStem(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || tx("fileStemFallback");
}

export function buildResearchExportTables(data: ResearchReportData): ExportTable[] {
  const { analytics, insights } = data;
  const ofTotal = tx("overview.ofTotal", { total: analytics.totalVideos });
  const summary: ExportTable = {
    name: tx("table.summary"),
    columns: [tx("col.field"), tx("col.value")],
    rows: [
      [tx("summary.report"), tx("summary.reportTitle")],
      [tx("summary.query"), data.query],
      [tx("summary.retrievedAt"), data.retrievedAt],
      [tx("summary.snapshotId"), data.snapshotId],
      [tx("summary.totalResults"), data.totalResults],
      [tx("summary.approximate"), data.totalResultsIsApproximate],
      [tx("summary.resultsPerPage"), data.resultsPerPage],
      [tx("summary.regionCode"), data.regionCode],
      [tx("summary.nextPageToken"), data.nextPageToken],
      [tx("summary.analyzedVideos"), analytics.totalVideos],
      [tx("summary.uniqueChannels"), analytics.uniqueChannels],
      [tx("summary.sampleViews"), analytics.totalViews],
      [tx("summary.avgViews"), analytics.avgViews],
      [tx("summary.medianViews"), analytics.medianViews],
      [tx("summary.medianDailyViews"), analytics.medianDailyViews],
      [tx("summary.interactionRate"), analytics.avgEngagement === "N/A" ? common("notAvailable") : `${analytics.avgEngagement}%`],
      [tx("summary.uploadDateFilter"), data.filters.uploadDate],
      [tx("summary.durationFilter"), data.filters.duration],
      [tx("summary.sortBy"), data.filters.sortBy],
      [tx("summary.languageFilter"), data.filters.language],
      [tx("summary.brief"), insights.summary],
    ],
  };

  const overview: ExportTable = {
    name: tx("table.overview"),
    columns: [tx("col.section"), tx("col.label"), tx("col.value"), tx("col.definition")],
    rows: [
      ...analytics.durationData.map((item) => [tx("overview.durationDistribution"), item.name, item.value, tx("overview.returnedVideos")]),
      ...analytics.recencyData.map((item) => [tx("overview.recency"), item.name, item.value, tx("overview.returnedVideos")]),
      ...analytics.topTags.map((item) => [tx("overview.recurringTags"), item.label, item.count, tx("overview.tagDefinition")]),
      [tx("overview.coverage"), tx("overview.coverageViews"), analytics.coverage.views, ofTotal],
      [tx("overview.coverage"), tx("overview.coverageEngagement"), analytics.coverage.engagement, ofTotal],
      [tx("overview.coverage"), tx("overview.coverageSubscribers"), analytics.coverage.subscribers, ofTotal],
      [tx("overview.coverage"), tx("overview.coverageCaptions"), analytics.coverage.captions, ofTotal],
      [tx("overview.coverage"), tx("overview.coverageTags"), analytics.coverage.tags, ofTotal],
      [tx("overview.coverage"), tx("overview.coverageHd"), analytics.coverage.hd, ofTotal],
      ...analytics.velocityLeaders.map(({ video, viewsPerDay }, index) => [
        tx("overview.velocityLeaders"),
        `${index + 1}. ${video.title}`,
        Math.round(viewsPerDay),
        tx("overview.velocityDefinition"),
      ]),
      ...analytics.breakoutLeaders.map(({ video, viewsPerSubscriber }, index) => [
        tx("overview.breakoutLeaders"),
        `${index + 1}. ${video.title}`,
        Number(viewsPerSubscriber.toFixed(2)),
        tx("overview.breakoutDefinition"),
      ]),
    ],
  };

  const videos: ExportTable = {
    name: tx("table.videos"),
    columns: [
      "rank", "videoId", "title", "channel", "channelId", "published", "duration",
      "views", "likes", "comments", "interactionRate",
      "outlierScore", "velocityScore", "viewsPerDay", "tags", "categoryId",
      "liveStatus", "captions", "definition", "licensedContent", "embeddable",
      "madeForKids", "paidPlacement", "defaultLanguage", "audioLanguage",
      "topicCategories", "liveActualStart", "liveActualEnd", "liveScheduledStart",
      "liveConcurrentViewers", "channelSubscribers", "subscribersHidden", "channelVideos",
      "channelViews", "channelCreated", "channelCountry", "channelCustomUrl",
      "channelDefaultLanguage", "channelKeywords", "channelTopicCategories",
      "channelThumbnailUrl", "channelDescription", "thumbnailUrl", "youtubeUrl", "description",
    ].map((column) => tx(`videos.${column}`)),
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
      roundedMetric(video.outlierScore),
      roundedMetric(video.velocityScore),
      roundedMetric(video.viewsPerDay, 0),
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
    name: tx("table.insights"),
    columns: [tx("col.section"), tx("col.element"), tx("col.detail")],
    rows: [
      [tx("insights.brief"), tx("insights.summary"), insights.summary],
      [tx("insights.intent"), tx("insights.primaryIntent"), insights.queryIntent.primaryIntent],
      [tx("insights.intent"), tx("insights.viewerNeed"), insights.queryIntent.viewerNeed],
      [tx("insights.intent"), tx("insights.discoverySurface"), insights.queryIntent.discoverySurface],
      [tx("insights.intent"), tx("insights.credibilityNote"), insights.queryIntent.credibilityNote],
      ...insights.evidenceSignals.observed.map((value, index) => [tx("insights.evidenceSignals"), tx("insights.observed", { index: index + 1 }), value]),
      ...insights.evidenceSignals.inferred.map((value, index) => [tx("insights.evidenceSignals"), tx("insights.inferred", { index: index + 1 }), value]),
      ...insights.evidenceSignals.requiresStudio.map((value, index) => [tx("insights.evidenceSignals"), tx("insights.requiresStudio", { index: index + 1 }), value]),
      ...insights.peopleAlsoAsk.flatMap((item, index) => [
        [tx("insights.viewerQuestions"), tx("insights.question", { index: index + 1 }), item.question],
        [tx("insights.viewerQuestions"), tx("insights.answer", { index: index + 1 }), item.answer],
      ]),
      [tx("insights.audience"), tx("insights.primaryDemographic"), insights.targetAudience.primaryDemographic],
      [tx("insights.audience"), tx("insights.ageRange"), insights.targetAudience.ageRange],
      [tx("insights.audience"), tx("insights.interests"), joined(insights.targetAudience.interests)],
      [tx("insights.audience"), tx("insights.painPoints"), joined(insights.targetAudience.painPoints)],
      [tx("insights.audience"), tx("insights.contentPreferences"), joined(insights.targetAudience.contentPreferences)],
      [tx("insights.niche"), tx("insights.competitionLevel"), insights.nicheAnalysis.competitionLevel],
      [tx("insights.niche"), tx("insights.growthTrend"), insights.nicheAnalysis.growthTrend],
      [tx("insights.niche"), tx("insights.postingTimes"), joined(insights.nicheAnalysis.bestPostingTimes)],
      [tx("insights.niche"), tx("insights.recommendedFormats"), joined(insights.nicheAnalysis.recommendedFormats)],
      [tx("insights.niche"), tx("insights.monetization"), insights.nicheAnalysis.monetizationPotential],
      ...insights.contentGaps.map((value, index) => [tx("insights.contentGaps"), tx("insights.gap", { index: index + 1 }), value]),
      ...insights.trendingSubtopics.map((value, index) => [tx("insights.subtopics"), tx("insights.subtopic", { index: index + 1 }), value]),
      ...insights.recommendedActions.flatMap((item, index) => [
        [tx("insights.actions"), tx("insights.action", { index: index + 1 }), item.title],
        [tx("insights.actions"), tx("insights.rationale", { index: index + 1 }), item.rationale],
        [tx("insights.actions"), tx("insights.format", { index: index + 1 }), item.format],
      ]),
      [tx("insights.methodology"), tx("insights.sampleSize"), insights.methodology.sampleSize],
      [tx("insights.methodology"), tx("insights.basis"), insights.methodology.basis],
      ...insights.methodology.limitations.map((value, index) => [tx("insights.methodology"), tx("insights.limitation", { index: index + 1 }), value]),
    ],
  };

  const evidence: ExportTable = {
    name: tx("table.evidence"),
    columns: ["id", "class", "claim", "confidence", "sourceVideoIds", "limitations", "snapshotId"].map((column) => tx(`evidence.${column}`)),
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
    name: tx("table.ideas"),
    columns: [
      "index", "title", "description", "keywords", "format", "difficulty", "discoverySurface",
      "honestPromise", "payoff", "thumbnailConcept", "studioMetric", "experimentRule",
      "evidenceClaimIds", "sourceVideoIds",
    ].map((column) => tx(`ideas.${column}`)),
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
    name: tx("table.provenance"),
    columns: [tx("col.section"), tx("col.field"), tx("col.value")],
    rows: [
      [tx("provenance.origin"), tx("provenance.provider"), data.provenance.provider],
      [tx("provenance.origin"), tx("provenance.query"), data.provenance.query],
      [tx("provenance.origin"), tx("provenance.orderedVideoIds"), joined(data.provenance.orderedVideoIds)],
      ...Object.entries(data.enrichment).flatMap(([stage, detail]) => [
        [tx("provenance.enrichment"), tx("provenance.status", { stage }), labelFor(ENRICHMENT_STATUS_LABELS, detail.status)],
        [tx("provenance.enrichment"), tx("provenance.requested", { stage }), detail.requested],
        [tx("provenance.enrichment"), tx("provenance.returned", { stage }), detail.returned],
      ]),
      ...data.warnings.map((warning, index) => [
        tx("provenance.warnings"),
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
  const rows: Cell[][] = [[tx("csv.table"), tx("csv.row"), tx("col.field"), tx("col.value")]];
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
    `${tx("filePrefix")}-${safeExportStem(data.query)}.csv`,
  );
}

export function downloadResearchXls(data: ResearchReportData): void {
  download(
    buildResearchXls(data),
    "application/vnd.ms-excel;charset=utf-8",
    `${tx("filePrefix")}-${safeExportStem(data.query)}.xls`,
  );
}
