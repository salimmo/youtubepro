import { jsPDF } from "jspdf";
import type { ResearchReportData } from "@/lib/research-export";
import { safeExportStem } from "@/lib/research-export";
import {
  CONFIDENCE_LABELS,
  DIFFICULTY_LABELS,
  DISCOVERY_SURFACE_LABELS,
  ENRICHMENT_STAGE_LABELS,
  ENRICHMENT_STATUS_LABELS,
  EVIDENCE_CLASS_LABELS,
  IDEA_FORMAT_LABELS,
  labelFor,
} from "@/lib/labels";
import { formatCompact as compactNumber, getActiveLanguage, intlLocale, translate, type TranslateVars } from "@/lib/i18n";

const INK: [number, number, number] = [35, 35, 35];
const MUTED: [number, number, number] = [102, 102, 102];
const BORDER: [number, number, number] = [218, 218, 218];
const SURFACE: [number, number, number] = [247, 246, 244];
const PRIMARY: [number, number, number] = [185, 86, 63];
const PRIMARY_LIGHT: [number, number, number] = [243, 220, 213];
const BLUE: [number, number, number] = [102, 142, 181];
const TEAL: [number, number, number] = [92, 155, 145];
const GOLD: [number, number, number] = [204, 161, 85];
const PURPLE: [number, number, number] = [142, 118, 177];

function tr(key: string, vars?: TranslateVars): string {
  return translate(getActiveLanguage(), key, vars);
}

function notAvailable(): string {
  return tr("common.notAvailable");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(intlLocale(getActiveLanguage()), { maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value: number): string {
  return compactNumber(getActiveLanguage(), value);
}

function readableDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(intlLocale(getActiveLanguage()), { dateStyle: "medium", timeStyle: "short" })
    : value;
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return notAvailable();
  if (typeof value === "boolean") return value ? tr("common.yes") : tr("common.no");
  return String(value).replace(/\s+/g, " ").trim();
}

interface TableColumn {
  label: string;
  width: number;
}

export function buildResearchPDF(data: ResearchReportData): jsPDF {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const contentBottom = pageHeight - 16;
  let y = 0;

  const drawPageHeader = (continuation = true) => {
    pdf.setFillColor(...PRIMARY);
    pdf.rect(0, 0, pageWidth, 4, "F");
    if (continuation) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTED);
      pdf.text(tr("script.researchPdf.headerLine"), margin, 11);
      pdf.setDrawColor(...BORDER);
      pdf.line(margin, 14, pageWidth - margin, 14);
      y = 21;
    } else {
      y = 16;
    }
  };

  const newPage = () => {
    pdf.addPage();
    drawPageHeader(true);
  };

  const ensure = (height: number) => {
    if (y + height > contentBottom) newPage();
  };

  const addWrapped = (
    value: unknown,
    options: {
      x?: number;
      width?: number;
      size?: number;
      lineHeight?: number;
      color?: [number, number, number];
      bold?: boolean;
      gapAfter?: number;
    } = {},
  ) => {
    const x = options.x ?? margin;
    const width = options.width ?? contentWidth;
    const size = options.size ?? 9;
    const lineHeight = options.lineHeight ?? 4.3;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color ?? INK));
    const lines = pdf.splitTextToSize(text(value), width) as string[];
    for (const line of lines) {
      ensure(lineHeight + 1);
      pdf.text(line, x, y);
      y += lineHeight;
    }
    y += options.gapAfter ?? 1.5;
  };

  const addSection = (title: string, subtitle?: string) => {
    ensure(subtitle ? 24 : 16);
    y += 3;
    pdf.setFillColor(...PRIMARY_LIGHT);
    pdf.roundedRect(margin, y, 3, 9, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...INK);
    pdf.text(title, margin + 7, y + 6.5);
    y += 13;
    if (subtitle) addWrapped(subtitle, { size: 8.2, color: MUTED, gapAfter: 3 });
  };

  const addLabelValue = (label: string, value: unknown) => {
    ensure(12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(label.toUpperCase(), margin, y);
    y += 4.5;
    addWrapped(value, { size: 9, gapAfter: 2.5 });
  };

  const addMetricCards = (metrics: { label: string; value: string; note: string }[]) => {
    const columns = 3;
    const gap = 3;
    const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
    const cardHeight = 24;
    metrics.forEach((metric, index) => {
      if (index % columns === 0) ensure(cardHeight + 3);
      const column = index % columns;
      const x = margin + column * (cardWidth + gap);
      pdf.setFillColor(...SURFACE);
      pdf.setDrawColor(...BORDER);
      pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.2);
      pdf.setTextColor(...MUTED);
      pdf.text(metric.label, x + 3, y + 5);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(...INK);
      pdf.text(metric.value, x + 3, y + 13);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(...MUTED);
      const noteLines = pdf.splitTextToSize(metric.note, cardWidth - 6).slice(0, 2) as string[];
      noteLines.forEach((line, lineIndex) => pdf.text(line, x + 3, y + 18 + lineIndex * 3));
      if (column === columns - 1 || index === metrics.length - 1) y += cardHeight + 3;
    });
    y += 2;
  };

  const addBarChart = (
    title: string,
    rows: { label: string; value: number }[],
    note: string,
    colors: [number, number, number][] = [PRIMARY],
  ) => {
    if (rows.length === 0) return;
    const visibleRows = rows.slice(0, 8);
    const blockHeight = 17 + visibleRows.length * 9;
    ensure(blockHeight);
    pdf.setFillColor(...SURFACE);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(margin, y, contentWidth, blockHeight, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...INK);
    pdf.text(title, margin + 4, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...MUTED);
    pdf.text(note, margin + 4, y + 11);
    const max = Math.max(...visibleRows.map((row) => row.value), 1);
    const labelWidth = 62;
    const barX = margin + labelWidth + 5;
    const barMaxWidth = contentWidth - labelWidth - 26;
    visibleRows.forEach((row, index) => {
      const rowY = y + 18 + index * 9;
      const label = row.label.length > 38 ? `${row.label.slice(0, 37)}...` : row.label;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...INK);
      pdf.text(label, margin + 4, rowY);
      pdf.setFillColor(230, 229, 227);
      pdf.roundedRect(barX, rowY - 3.4, barMaxWidth, 4, 1, 1, "F");
      const barWidth = Math.max(row.value > 0 ? 1 : 0, (row.value / max) * barMaxWidth);
      pdf.setFillColor(...colors[index % colors.length]);
      pdf.roundedRect(barX, rowY - 3.4, barWidth, 4, 1, 1, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...INK);
      pdf.text(formatCompact(row.value), pageWidth - margin - 4, rowY, { align: "right" });
    });
    y += blockHeight + 5;
  };

  const addTable = (columns: TableColumn[], rows: unknown[][]) => {
    const rowPadding = 2;
    const lineHeight = 3.5;
    const drawHeader = () => {
      ensure(9);
      pdf.setFillColor(...PRIMARY);
      pdf.rect(margin, y, contentWidth, 8, "F");
      let x = margin;
      columns.forEach((column) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        pdf.text(column.label, x + rowPadding, y + 5.2);
        x += column.width;
      });
      y += 8;
    };
    drawHeader();
    rows.forEach((row, rowIndex) => {
      const lineSets = columns.map((column, columnIndex) =>
        pdf.splitTextToSize(text(row[columnIndex]), column.width - rowPadding * 2) as string[],
      );
      const height = Math.max(8, Math.max(...lineSets.map((lines) => lines.length)) * lineHeight + rowPadding * 2);
      if (y + height > contentBottom) {
        newPage();
        drawHeader();
      }
      if (rowIndex % 2 === 0) {
        pdf.setFillColor(...SURFACE);
        pdf.rect(margin, y, contentWidth, height, "F");
      }
      pdf.setDrawColor(...BORDER);
      pdf.line(margin, y + height, pageWidth - margin, y + height);
      let x = margin;
      lineSets.forEach((lines, columnIndex) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.7);
        pdf.setTextColor(...INK);
        lines.forEach((line, lineIndex) => pdf.text(line, x + rowPadding, y + rowPadding + 2.6 + lineIndex * lineHeight));
        x += columns[columnIndex].width;
      });
      y += height;
    });
    y += 5;
  };

  drawPageHeader(false);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(...INK);
  pdf.text(tr("script.researchPdf.title"), margin, y + 7);
  y += 14;
  addWrapped(tr("script.researchPdf.snapshotFor", { query: data.query }), { size: 11, color: MUTED, gapAfter: 2 });
  addWrapped(tr("script.researchPdf.retrievedLine", { date: readableDate(data.retrievedAt), videos: data.videos.length, channels: data.analytics.uniqueChannels }), {
    size: 8,
    color: MUTED,
    gapAfter: 5,
  });

  addSection(tr("script.researchPdf.summary"));
  addWrapped(data.insights.summary, { size: 10, lineHeight: 5, gapAfter: 4 });
  addWrapped(tr("script.researchPdf.viewerNeed", { value: data.insights.queryIntent.viewerNeed }), { size: 9, bold: true });
  addWrapped(tr("script.researchPdf.credibilityNote", { value: data.insights.queryIntent.credibilityNote }), { size: 8.5, color: MUTED, gapAfter: 4 });

  addMetricCards([
    { label: tr("script.researchPdf.metric.totalViews"), value: formatCompact(data.analytics.totalViews), note: tr("script.researchPdf.metric.totalViewsNote") },
    { label: tr("script.researchPdf.metric.medianViews"), value: formatCompact(data.analytics.medianViews), note: tr("script.researchPdf.metric.medianViewsNote") },
    { label: tr("script.researchPdf.metric.medianDailyViews"), value: formatCompact(data.analytics.medianDailyViews), note: tr("script.researchPdf.metric.medianDailyViewsNote") },
    { label: tr("script.researchPdf.metric.engagement"), value: data.analytics.avgEngagement === "N/A" ? notAvailable() : `${data.analytics.avgEngagement}%`, note: tr("script.researchPdf.metric.engagementNote") },
    { label: tr("script.researchPdf.metric.avgViews"), value: formatCompact(data.analytics.avgViews), note: tr("script.researchPdf.metric.avgViewsNote") },
    { label: tr("script.researchPdf.metric.totalVideos"), value: formatNumber(data.analytics.totalVideos), note: tr("script.researchPdf.metric.totalVideosNote") },
  ]);

  addSection(tr("script.researchPdf.keyFindings"), tr("script.researchPdf.keyFindingsSubtitle"));
  addBarChart(
    tr("script.researchPdf.chart.topVideos"),
    data.analytics.topVideosList.map((video) => ({ label: video.title, value: video.viewCount || 0 })),
    tr("script.researchPdf.chart.topVideosNote"),
  );
  addBarChart(
    tr("script.researchPdf.chart.velocity"),
    data.analytics.velocityLeaders.map(({ video, viewsPerDay }) => ({ label: video.title, value: Math.round(viewsPerDay) })),
    tr("script.researchPdf.chart.velocityNote"),
    [BLUE],
  );
  addBarChart(
    tr("script.researchPdf.chart.breakout"),
    data.analytics.breakoutLeaders.map(({ video, viewsPerSubscriber }) => ({ label: video.title, value: Number(viewsPerSubscriber.toFixed(2)) })),
    tr("script.researchPdf.chart.breakoutNote"),
    [PURPLE],
  );
  addBarChart(
    tr("script.researchPdf.chart.tags"),
    data.analytics.topTags.map((item) => ({ label: item.label, value: item.count })),
    tr("script.researchPdf.chart.tagsNote"),
    [GOLD],
  );
  addBarChart(tr("script.researchPdf.chart.duration"), data.analytics.durationData.map((item) => ({ label: item.name, value: item.value })), tr("script.researchPdf.chart.durationNote"), [PRIMARY, BLUE, GOLD]);
  addBarChart(tr("script.researchPdf.chart.recency"), data.analytics.recencyData.map((item) => ({ label: item.name, value: item.value })), tr("script.researchPdf.chart.recencyNote"), [BLUE, TEAL, PURPLE, GOLD]);
  addBarChart(
    tr("script.researchPdf.chart.coverage"),
    [
      { label: tr("script.researchPdf.coverage.views"), value: data.analytics.coverage.views },
      { label: tr("script.researchPdf.coverage.engagement"), value: data.analytics.coverage.engagement },
      { label: tr("script.researchPdf.coverage.subscribers"), value: data.analytics.coverage.subscribers },
      { label: tr("script.researchPdf.coverage.captions"), value: data.analytics.coverage.captions },
      { label: tr("script.researchPdf.coverage.tags"), value: data.analytics.coverage.tags },
      { label: tr("script.researchPdf.coverage.hd"), value: data.analytics.coverage.hd },
    ],
    tr("script.researchPdf.chart.coverageNote", { total: data.analytics.totalVideos }),
    [TEAL],
  );

  addSection(tr("script.researchPdf.audienceSection"));
  addLabelValue(tr("script.researchPdf.primaryIntent"), data.insights.queryIntent.primaryIntent);
  addLabelValue(tr("script.researchPdf.discoverySurface"), labelFor(DISCOVERY_SURFACE_LABELS, data.insights.queryIntent.discoverySurface));
  addLabelValue(tr("script.researchPdf.audienceHypothesis"), tr("script.researchPdf.audienceHypothesisValue", { demographic: data.insights.targetAudience.primaryDemographic, ageRange: data.insights.targetAudience.ageRange }));
  addLabelValue(tr("script.researchPdf.interests"), data.insights.targetAudience.interests.join("; "));
  addLabelValue(tr("script.researchPdf.painPoints"), data.insights.targetAudience.painPoints.join("; "));
  addLabelValue(tr("script.researchPdf.contentPreferences"), data.insights.targetAudience.contentPreferences.join("; "));
  addLabelValue(tr("script.researchPdf.competition"), data.insights.nicheAnalysis.competitionLevel);
  addLabelValue(tr("script.researchPdf.growthTrend"), data.insights.nicheAnalysis.growthTrend);
  addLabelValue(tr("script.researchPdf.recommendedFormats"), data.insights.nicheAnalysis.recommendedFormats.join("; "));
  addLabelValue(tr("script.researchPdf.monetization"), data.insights.nicheAnalysis.monetizationPotential);

  addSection(tr("script.researchPdf.opportunitiesSection"));
  addLabelValue(tr("script.researchPdf.contentGaps"), data.insights.contentGaps.map((value, index) => `${index + 1}. ${value}`).join("; "));
  addLabelValue(tr("script.researchPdf.subtopics"), data.insights.trendingSubtopics.join("; "));
  addLabelValue(tr("script.researchPdf.postingTimes"), data.insights.nicheAnalysis.bestPostingTimes.join("; "));

  addSection(tr("script.researchPdf.signalsSection"));
  ([
    [tr("script.researchPdf.signals.observed"), data.insights.evidenceSignals.observed],
    [tr("script.researchPdf.signals.inferred"), data.insights.evidenceSignals.inferred],
    [tr("script.researchPdf.signals.requiresStudio"), data.insights.evidenceSignals.requiresStudio],
  ] as const).forEach(([label, values]) => {
    addWrapped(label, { size: 9, bold: true, color: PRIMARY, gapAfter: 1 });
    values.forEach((value, index) => addWrapped(`${index + 1}. ${value}`, { size: 8.5, x: margin + 3, width: contentWidth - 3, gapAfter: 1.5 }));
    y += 2;
  });

  addSection(tr("script.researchPdf.nextSteps"));
  data.insights.recommendedActions.forEach((action, index) => {
    addWrapped(`${index + 1}. ${action.title}`, { size: 9.5, bold: true, gapAfter: 1 });
    addWrapped(tr("script.researchPdf.actionRationale", { rationale: action.rationale, format: action.format }), { size: 8.5, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 3 });
  });

  addSection(tr("script.researchPdf.peopleAlsoAsk"));
  data.insights.peopleAlsoAsk.forEach((item, index) => {
    addWrapped(`${index + 1}. ${item.question}`, { size: 9, bold: true, gapAfter: 1 });
    addWrapped(item.answer, { size: 8.3, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 3 });
  });

  addSection(tr("script.researchPdf.ideasSection"), tr("script.researchPdf.ideasSubtitle"));
  data.ideas.forEach((idea, index) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    const titleLines = pdf.splitTextToSize(`${index + 1}. ${text(idea.title)}`, contentWidth - 6) as string[];
    const titleHeight = Math.max(8, titleLines.length * 4.2 + 4);
    ensure(titleHeight + 27);
    pdf.setFillColor(...SURFACE);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(margin, y, contentWidth, titleHeight, 1.5, 1.5, "FD");
    pdf.setTextColor(...INK);
    titleLines.forEach((line, lineIndex) => pdf.text(line, margin + 3, y + 5.2 + lineIndex * 4.2));
    y += titleHeight + 4;
    addLabelValue(tr("script.researchPdf.idea.package"), `${labelFor(IDEA_FORMAT_LABELS, idea.format)}  |  ${labelFor(DIFFICULTY_LABELS, idea.difficulty)}  |  ${labelFor(DISCOVERY_SURFACE_LABELS, idea.discoverySurface)}`);
    addLabelValue(tr("script.researchPdf.idea.description"), idea.description);
    addLabelValue(tr("script.researchPdf.idea.keywords"), idea.keywords.join(", "));
    addLabelValue(tr("script.researchPdf.idea.honestPromise"), idea.honestPromise);
    addLabelValue(tr("script.researchPdf.idea.payoff"), idea.payoff);
    addLabelValue(tr("script.researchPdf.idea.thumbnailConcept"), idea.thumbnailConcept);
    addLabelValue(tr("script.researchPdf.idea.studioValidation"), tr("script.researchPdf.idea.studioValidationValue", { metric: idea.studioMetric, rule: idea.experimentRule }));
    addLabelValue(tr("script.researchPdf.idea.evidenceClaimIds"), idea.evidenceClaims.map((claim) => claim.id).join(", "));
    y += 3;
  });

  addSection(tr("script.researchPdf.evidenceSection"), tr("script.researchPdf.evidenceSubtitle"));
  data.insights.evidenceClaims.forEach((claim, index) => {
    ensure(24);
    addWrapped(`${index + 1}. ${claim.id}  |  ${labelFor(EVIDENCE_CLASS_LABELS, claim.evidenceClass)}  |  ${tr("script.researchPdf.evidence.confidence")}: ${labelFor(CONFIDENCE_LABELS, claim.confidence)}`, {
      size: 9,
      bold: true,
      color: PRIMARY,
      gapAfter: 1,
    });
    addWrapped(claim.claim, { size: 8.5, x: margin + 3, width: contentWidth - 3, gapAfter: 1 });
    addWrapped(tr("script.researchPdf.evidence.sources", { value: claim.sourceVideoIds.join(", ") || notAvailable() }), { size: 7.5, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 1 });
    addWrapped(tr("script.researchPdf.evidence.limitations", { value: claim.limitations.join("; ") }), { size: 7.5, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 3 });
  });

  addSection(tr("script.researchPdf.appendixSection"), tr("script.researchPdf.appendixSubtitle"));
  addTable(
    [
      { label: "#", width: 8 },
      { label: tr("script.researchPdf.table.videoAndChannel"), width: 85 },
      { label: tr("script.researchPdf.table.published"), width: 28 },
      { label: tr("script.researchPdf.table.views"), width: 22 },
      { label: tr("script.researchPdf.table.likesComments"), width: 27 },
      { label: tr("script.researchPdf.table.duration"), width: 12 },
    ],
    data.videos.map((video, index) => [
      index + 1,
      `${video.title}\n${video.channelTitle}\nhttps://www.youtube.com/watch?v=${video.id}`,
      readableDate(video.publishedAt).replace(/, \d{1,2}:.*$/, ""),
      video.viewCount === undefined ? notAvailable() : formatNumber(video.viewCount),
      `${video.likeCount === undefined ? notAvailable() : formatNumber(video.likeCount)} / ${video.commentCount === undefined ? notAvailable() : formatNumber(video.commentCount)}`,
      video.duration || notAvailable(),
    ]),
  );

  addSection(tr("script.researchPdf.detailsSection"), tr("script.researchPdf.detailsSubtitle"));
  data.videos.forEach((video, index) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    const headerLines = pdf.splitTextToSize(`${index + 1}. ${video.title}`, contentWidth - 6) as string[];
    const headerHeight = Math.max(8, headerLines.length * 4.2 + 4);
    ensure(headerHeight + 18);
    pdf.setFillColor(...SURFACE);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(margin, y, contentWidth, headerHeight, 1.5, 1.5, "FD");
    pdf.setTextColor(...INK);
    headerLines.forEach((line, lineIndex) => pdf.text(line, margin + 3, y + 5.2 + lineIndex * 4.2));
    y += headerHeight + 4;
    addLabelValue(tr("script.researchPdf.video.identity"), tr("script.researchPdf.video.identityValue", { id: video.id, url: `https://www.youtube.com/watch?v=${video.id}` }));
    addLabelValue(tr("script.researchPdf.video.channel"), tr("script.researchPdf.video.channelValue", { title: video.channelTitle, id: video.channelId }));
    addLabelValue(tr("script.researchPdf.video.publishedDuration"), tr("script.researchPdf.video.publishedDurationValue", { date: readableDate(video.publishedAt), duration: video.duration || notAvailable() }));
    addLabelValue(tr("script.researchPdf.video.performance"), tr("script.researchPdf.video.performanceValue", { views: text(video.viewCount), likes: text(video.likeCount), comments: text(video.commentCount) }));
    addLabelValue(tr("script.researchPdf.video.contentMeta"), tr("script.researchPdf.video.contentMetaValue", {
      category: text(video.categoryId),
      live: text(video.liveBroadcastContent),
      definition: text(video.definition),
      captions: text(video.hasCaptions),
      language: text(video.defaultLanguage),
      audioLanguage: text(video.defaultAudioLanguage),
    }));
    addLabelValue(tr("script.researchPdf.video.statusFields"), tr("script.researchPdf.video.statusFieldsValue", {
      licensed: text(video.licensedContent),
      embeddable: text(video.embeddable),
      kids: text(video.madeForKids),
      paid: text(video.hasPaidProductPlacement),
    }));
    addLabelValue(tr("script.researchPdf.video.tags"), video.tags?.join(", ") || notAvailable());
    addLabelValue(tr("script.researchPdf.video.topicCategories"), video.topicCategories?.join("; ") || notAvailable());
    addLabelValue(tr("script.researchPdf.video.liveDetails"), video.liveStreamingDetails
      ? Object.entries(video.liveStreamingDetails).map(([key, value]) => `${key}: ${text(value)}`).join("; ")
      : notAvailable());
    addLabelValue(tr("script.researchPdf.video.description"), video.description || notAvailable());
    addLabelValue(tr("script.researchPdf.video.thumbnail"), video.thumbnailUrl);
    const channel = video.channelStatistics;
    addLabelValue(tr("script.researchPdf.video.channelStats"), channel
      ? tr("script.researchPdf.video.channelStatsValue", {
        subscribers: text(channel.subscriberCount),
        hidden: text(channel.hiddenSubscriberCount),
        videos: text(channel.videoCount),
        views: text(channel.viewCount),
        created: text(channel.publishedAt),
        country: text(channel.country),
        customUrl: text(channel.customUrl),
        language: text(channel.defaultLanguage),
      })
      : notAvailable());
    addLabelValue(tr("script.researchPdf.video.channelKeywords"), channel?.keywords || notAvailable());
    addLabelValue(tr("script.researchPdf.video.channelTopics"), channel?.topicCategories?.join("; ") || notAvailable());
    addLabelValue(tr("script.researchPdf.video.channelDescription"), channel?.description || notAvailable());
    addLabelValue(tr("script.researchPdf.video.channelThumbnail"), channel?.thumbnailUrl || notAvailable());
    y += 5;
  });

  addSection(tr("script.researchPdf.caveatsSection"));
  addLabelValue(tr("script.researchPdf.method"), data.insights.methodology.basis);
  addLabelValue(tr("script.researchPdf.sample"), tr("script.researchPdf.sampleValue", {
    size: data.insights.methodology.sampleSize,
    total: formatNumber(data.totalResults),
    approx: data.totalResultsIsApproximate ? tr("script.researchPdf.approximate") : "",
  }));
  data.insights.methodology.limitations.forEach((limitation, index) => addWrapped(`${index + 1}. ${limitation}`, { size: 8.5, gapAfter: 2 }));
  addLabelValue(tr("script.researchPdf.provider"), data.provenance.provider);
  addLabelValue(tr("script.researchPdf.filters"), tr("script.researchPdf.filtersValue", { uploadDate: data.filters.uploadDate, duration: data.filters.duration, sortBy: data.filters.sortBy }));
  addLabelValue(tr("script.researchPdf.snapshotId"), data.snapshotId);
  addLabelValue(tr("script.researchPdf.searchResponse"), tr("script.researchPdf.searchResponseValue", { perPage: text(data.resultsPerPage), region: text(data.regionCode), token: text(data.nextPageToken) }));
  addLabelValue(tr("script.researchPdf.enrichment"), Object.entries(data.enrichment).map(([stage, detail]) => `${labelFor(ENRICHMENT_STAGE_LABELS, stage)}: ${labelFor(ENRICHMENT_STATUS_LABELS, detail.status)} (${detail.returned}/${detail.requested})`).join("; "));
  if (data.warnings.length > 0) {
    data.warnings.forEach((warning, index) => addWrapped(`${index + 1}. ${warning.stage}: ${warning.message}`, { size: 8.5, color: MUTED, gapAfter: 2 }));
  } else {
    addWrapped(tr("script.researchPdf.noWarnings"), { size: 8.5, color: MUTED });
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...BORDER);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(tr("script.researchPdf.footer"), margin, pageHeight - 7);
    pdf.text(tr("script.researchPdf.pageOf", { page, total: totalPages }), pageWidth - margin, pageHeight - 7, { align: "right" });
  }

  return pdf;
}

export async function generateResearchPDF(data: ResearchReportData): Promise<void> {
  buildResearchPDF(data).save(`youtube-research-${safeExportStem(data.query)}.pdf`);
}
