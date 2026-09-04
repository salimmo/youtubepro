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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function readableDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })
    : value;
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "k. A.";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
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
      pdf.text("YOUTUBE PRO  /  RECHERCHE-BERICHT", margin, 11);
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
  pdf.text("YouTube-Recherche-Bericht", margin, y + 7);
  y += 14;
  addWrapped(`Recherche-Snapshot für "${data.query}"`, { size: 11, color: MUTED, gapAfter: 2 });
  addWrapped(`Abgerufen am ${readableDate(data.retrievedAt)}  |  ${data.videos.length} zurückgegebene Videos  |  ${data.analytics.uniqueChannels} Kanäle`, {
    size: 8,
    color: MUTED,
    gapAfter: 5,
  });

  addSection("Zusammenfassung");
  addWrapped(data.insights.summary, { size: 10, lineHeight: 5, gapAfter: 4 });
  addWrapped(`Zuschauerbedürfnis: ${data.insights.queryIntent.viewerNeed}`, { size: 9, bold: true });
  addWrapped(`Hinweis zur Glaubwürdigkeit: ${data.insights.queryIntent.credibilityNote}`, { size: 8.5, color: MUTED, gapAfter: 4 });

  addMetricCards([
    { label: "Aufrufe der Stichprobe", value: formatCompact(data.analytics.totalViews), note: "Summe über alle zurückgegebenen Videos" },
    { label: "Median der Aufrufe", value: formatCompact(data.analytics.medianViews), note: "Weniger durch virale Ausreißer verzerrt" },
    { label: "Median der Aufrufe pro Tag", value: formatCompact(data.analytics.medianDailyViews), note: "Altersbereinigtes, richtungsweisendes Momentum" },
    { label: "Sichtbare Interaktionsrate", value: data.analytics.avgEngagement === "N/A" ? "k. A." : `${data.analytics.avgEngagement}%`, note: "Likes plus Kommentare pro erfasstem Aufruf" },
    { label: "Durchschnittliche Aufrufe", value: formatCompact(data.analytics.avgViews), note: "Zusammen mit dem Median zur Beurteilung der Schiefe nutzen" },
    { label: "Analysierte Videos", value: formatNumber(data.analytics.totalVideos), note: "Maximal 50 pro Suchanfrage" },
  ]);

  addSection("Wichtigste Erkenntnisse mit visueller Evidenz", "Öffentliche Metadaten der YouTube Data API für diese Stichprobe, keine Analytics des Kanalinhabers.");
  addBarChart(
    "Top-Videos nach Aufrufen",
    data.analytics.topVideosList.map((video) => ({ label: video.title, value: video.viewCount || 0 })),
    "Absolute öffentliche Aufrufe in der zurückgegebenen Stichprobe",
  );
  addBarChart(
    "Momentum-Spitzenreiter",
    data.analytics.velocityLeaders.map(({ video, viewsPerDay }) => ({ label: video.title, value: Math.round(viewsPerDay) })),
    "Aufrufe pro Tag gleichen das Videoalter aus; das ist keine Echtzeit-Geschwindigkeit",
    [BLUE],
  );
  addBarChart(
    "Breakout im Verhältnis zu aktuellen Abonnenten",
    data.analytics.breakoutLeaders.map(({ video, viewsPerSubscriber }) => ({ label: video.title, value: Number(viewsPerSubscriber.toFixed(2)) })),
    "Nutzt aktuelle, gerundete öffentliche Abonnentenzahlen; richtungsweisend, nicht die Leistung zum Veröffentlichungszeitpunkt",
    [PURPLE],
  );
  addBarChart(
    "Wiederkehrende öffentliche Tags",
    data.analytics.topTags.map((item) => ({ label: item.label, value: item.count })),
    "Anzahl der verschiedenen zurückgegebenen Videos je verfügbarem öffentlichen Tag",
    [GOLD],
  );
  addBarChart("Verteilung der Videodauer", data.analytics.durationData.map((item) => ({ label: item.name, value: item.value })), "Anzahl der zurückgegebenen Videos", [PRIMARY, BLUE, GOLD]);
  addBarChart("Aktualität der Veröffentlichung", data.analytics.recencyData.map((item) => ({ label: item.name, value: item.value })), "Aktualitätsmix, kein Beleg für Themenwachstum", [BLUE, TEAL, PURPLE, GOLD]);
  addBarChart(
    "Abdeckung öffentlicher Daten",
    [
      { label: "Aufrufe", value: data.analytics.coverage.views },
      { label: "Vollständiges Engagement", value: data.analytics.coverage.engagement },
      { label: "Öffentliche Abonnenten", value: data.analytics.coverage.subscribers },
      { label: "Untertitel verfügbar", value: data.analytics.coverage.captions },
      { label: "Öffentliche Tags", value: data.analytics.coverage.tags },
      { label: "HD-Auflösung", value: data.analytics.coverage.hd },
    ],
    `Erfasste Datensätze von ${data.analytics.totalVideos}; nicht verfügbare Felder werden nicht zu null umgewandelt`,
    [TEAL],
  );

  addSection("Interpretation von Zielgruppe und Packaging");
  addLabelValue("Primäre Absicht", data.insights.queryIntent.primaryIntent);
  addLabelValue("Wahrscheinliche Discovery-Surface", labelFor(DISCOVERY_SURFACE_LABELS, data.insights.queryIntent.discoverySurface));
  addLabelValue("Zielgruppen-Hypothese", `${data.insights.targetAudience.primaryDemographic}. Hypothese zur Altersspanne: ${data.insights.targetAudience.ageRange}.`);
  addLabelValue("Interessen", data.insights.targetAudience.interests.join("; "));
  addLabelValue("Schmerzpunkte", data.insights.targetAudience.painPoints.join("; "));
  addLabelValue("Content-Vorlieben", data.insights.targetAudience.contentPreferences.join("; "));
  addLabelValue("Wettbewerb", data.insights.nicheAnalysis.competitionLevel);
  addLabelValue("Wachstumsinterpretation", data.insights.nicheAnalysis.growthTrend);
  addLabelValue("Empfohlene Formate", data.insights.nicheAnalysis.recommendedFormats.join("; "));
  addLabelValue("Monetarisierungs-Hypothese", data.insights.nicheAnalysis.monetizationPotential);

  addSection("Content-Chancen und Packaging-Impulse");
  addLabelValue("Content-Lücken", data.insights.contentGaps.map((value, index) => `${index + 1}. ${value}`).join("; "));
  addLabelValue("Unterthemen", data.insights.trendingSubtopics.join("; "));
  addLabelValue("Hypothesen zur Veröffentlichungszeit", data.insights.nicheAnalysis.bestPostingTimes.join("; "));

  addSection("Beobachtete, abgeleitete und nur in Studio verfügbare Signale");
  ([
    ["In dieser öffentlichen Stichprobe beobachtet", data.insights.evidenceSignals.observed],
    ["Abgeleitete Hypothesen", data.insights.evidenceSignals.inferred],
    ["Erfordert private YouTube-Studio-Daten", data.insights.evidenceSignals.requiresStudio],
  ] as const).forEach(([label, values]) => {
    addWrapped(label, { size: 9, bold: true, color: PRIMARY, gapAfter: 1 });
    values.forEach((value, index) => addWrapped(`${index + 1}. ${value}`, { size: 8.5, x: margin + 3, width: contentWidth - 3, gapAfter: 1.5 }));
    y += 2;
  });

  addSection("Empfohlene nächste Schritte");
  data.insights.recommendedActions.forEach((action, index) => {
    addWrapped(`${index + 1}. ${action.title}`, { size: 9.5, bold: true, gapAfter: 1 });
    addWrapped(`${action.rationale} Format: ${action.format}.`, { size: 8.5, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 3 });
  });

  addSection("Weitere Fragen");
  data.insights.peopleAlsoAsk.forEach((item, index) => {
    addWrapped(`${index + 1}. ${item.question}`, { size: 9, bold: true, gapAfter: 1 });
    addWrapped(item.answer, { size: 8.3, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 3 });
  });

  addSection("Fundierte Ideenpakete", "Jedes Paket ist an Evidenz-Claim-IDs aus diesem Snapshot gebunden und enthält eine Validierungsregel für das private YouTube Studio.");
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
    addLabelValue("Paket", `${labelFor(IDEA_FORMAT_LABELS, idea.format)}  |  ${labelFor(DIFFICULTY_LABELS, idea.difficulty)}  |  ${labelFor(DISCOVERY_SURFACE_LABELS, idea.discoverySurface)}`);
    addLabelValue("Beschreibung", idea.description);
    addLabelValue("Keywords", idea.keywords.join(", "));
    addLabelValue("Ehrliches Versprechen", idea.honestPromise);
    addLabelValue("Payoff", idea.payoff);
    addLabelValue("Thumbnail-Konzept", idea.thumbnailConcept);
    addLabelValue("Studio-Validierung", `${idea.studioMetric} Experiment-Regel: ${idea.experimentRule}`);
    addLabelValue("Evidenz-Claim-IDs", idea.evidenceClaims.map((claim) => claim.id).join(", "));
    y += 3;
  });

  addSection("Evidenz-Protokoll", "Beobachtete Claims verweisen auf Quellvideos. Ableitungen und reine Studio-Prüfungen bleiben als solche gekennzeichnet.");
  data.insights.evidenceClaims.forEach((claim, index) => {
    ensure(24);
    addWrapped(`${index + 1}. ${claim.id}  |  ${labelFor(EVIDENCE_CLASS_LABELS, claim.evidenceClass)}  |  Konfidenz: ${labelFor(CONFIDENCE_LABELS, claim.confidence)}`, {
      size: 9,
      bold: true,
      color: PRIMARY,
      gapAfter: 1,
    });
    addWrapped(claim.claim, { size: 8.5, x: margin + 3, width: contentWidth - 3, gapAfter: 1 });
    addWrapped(`Quellen: ${claim.sourceVideoIds.join(", ") || "k. A."}`, { size: 7.5, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 1 });
    addWrapped(`Einschränkungen: ${claim.limitations.join("; ")}`, { size: 7.5, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 3 });
  });

  addSection("Anhang: Videoergebnisse", "Exakte öffentliche Werte für die geordnete Quellstichprobe. Ausführliche Beschreibungen und alle verfügbaren Metadatenfelder sind in den XLS- und CSV-Exporten enthalten.");
  addTable(
    [
      { label: "#", width: 8 },
      { label: "Video und Kanal", width: 85 },
      { label: "Veröffentlicht", width: 28 },
      { label: "Aufrufe", width: 22 },
      { label: "Likes / Kommentare", width: 27 },
      { label: "Dauer", width: 12 },
    ],
    data.videos.map((video, index) => [
      index + 1,
      `${video.title}\n${video.channelTitle}\nhttps://www.youtube.com/watch?v=${video.id}`,
      readableDate(video.publishedAt).replace(/, \d{1,2}:.*$/, ""),
      video.viewCount === undefined ? "k. A." : formatNumber(video.viewCount),
      `${video.likeCount === undefined ? "k. A." : formatNumber(video.likeCount)} / ${video.commentCount === undefined ? "k. A." : formatNumber(video.commentCount)}`,
      video.duration || "k. A.",
    ]),
  );

  addSection("Detaillierte Video-Metadaten", "Vollständige öffentliche Felder für jeden geordneten Quelldatensatz. Fehlende Werte bleiben als k. A. gekennzeichnet.");
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
    addLabelValue("Video-Identität", `Video-ID: ${video.id}; URL: https://www.youtube.com/watch?v=${video.id}`);
    addLabelValue("Kanal", `${video.channelTitle}; Kanal-ID: ${video.channelId}`);
    addLabelValue("Veröffentlichung und Dauer", `${readableDate(video.publishedAt)}; Dauer: ${video.duration || "k. A."}`);
    addLabelValue("Öffentliche Performance", `Aufrufe: ${text(video.viewCount)}; Likes: ${text(video.likeCount)}; Kommentare: ${text(video.commentCount)}`);
    addLabelValue("Content-Metadaten", `Kategorie: ${text(video.categoryId)}; Live-Status: ${text(video.liveBroadcastContent)}; Auflösung: ${text(video.definition)}; Untertitel: ${text(video.hasCaptions)}; Standardsprache: ${text(video.defaultLanguage)}; Audiosprache: ${text(video.defaultAudioLanguage)}`);
    addLabelValue("Öffentliche Statusfelder", `Lizenziert: ${text(video.licensedContent)}; einbettbar: ${text(video.embeddable)}; für Kinder: ${text(video.madeForKids)}; bezahlte Produktplatzierung: ${text(video.hasPaidProductPlacement)}`);
    addLabelValue("Tags", video.tags?.join(", ") || "k. A.");
    addLabelValue("Themenkategorien", video.topicCategories?.join("; ") || "k. A.");
    addLabelValue("Live-Details", video.liveStreamingDetails
      ? Object.entries(video.liveStreamingDetails).map(([key, value]) => `${key}: ${text(value)}`).join("; ")
      : "k. A.");
    addLabelValue("Videobeschreibung", video.description || "k. A.");
    addLabelValue("Thumbnail", video.thumbnailUrl);
    const channel = video.channelStatistics;
    addLabelValue("Kanalstatistiken", channel
      ? `Abonnenten: ${text(channel.subscriberCount)}; verborgene Abonnenten: ${text(channel.hiddenSubscriberCount)}; Videos: ${text(channel.videoCount)}; Aufrufe: ${text(channel.viewCount)}; erstellt: ${text(channel.publishedAt)}; Land: ${text(channel.country)}; benutzerdefinierte URL: ${text(channel.customUrl)}; Standardsprache: ${text(channel.defaultLanguage)}`
      : "k. A.");
    addLabelValue("Kanal-Keywords", channel?.keywords || "k. A.");
    addLabelValue("Kanal-Themenkategorien", channel?.topicCategories?.join("; ") || "k. A.");
    addLabelValue("Kanalbeschreibung", channel?.description || "k. A.");
    addLabelValue("Kanal-Thumbnail", channel?.thumbnailUrl || "k. A.");
    y += 5;
  });

  addSection("Vorbehalte, Abdeckung und Quellenkontext");
  addLabelValue("Methode", data.insights.methodology.basis);
  addLabelValue("Stichprobe", `${data.insights.methodology.sampleSize} zurückgegebene Videos. Die von YouTube geschätzte Trefferzahl lag bei ${formatNumber(data.totalResults)}${data.totalResultsIsApproximate ? " (Näherungswert)" : ""}.`);
  data.insights.methodology.limitations.forEach((limitation, index) => addWrapped(`${index + 1}. ${limitation}`, { size: 8.5, gapAfter: 2 }));
  addLabelValue("Anbieter", data.provenance.provider);
  addLabelValue("Filter", `Upload-Datum: ${data.filters.uploadDate}; Dauer: ${data.filters.duration}; Sortierung: ${data.filters.sortBy}.`);
  addLabelValue("Snapshot-ID", data.snapshotId);
  addLabelValue("Suchantwort", `Ergebnisse pro Seite: ${text(data.resultsPerPage)}; Regionscode: ${text(data.regionCode)}; Token für nächste Seite: ${text(data.nextPageToken)}`);
  addLabelValue("Anreicherung", Object.entries(data.enrichment).map(([stage, detail]) => `${labelFor(ENRICHMENT_STAGE_LABELS, stage)}: ${labelFor(ENRICHMENT_STATUS_LABELS, detail.status)} (${detail.returned}/${detail.requested})`).join("; "));
  if (data.warnings.length > 0) {
    data.warnings.forEach((warning, index) => addWrapped(`${index + 1}. ${warning.stage}: ${warning.message}`, { size: 8.5, color: MUTED, gapAfter: 2 }));
  } else {
    addWrapped("Für diesen Snapshot wurden keine Anreicherungswarnungen des Anbieters gemeldet.", { size: 8.5, color: MUTED });
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...BORDER);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text("Öffentliche YouTube-Metadaten plus gekennzeichnete KI-Interpretation", margin, pageHeight - 7);
    pdf.text(`Seite ${page} von ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }

  return pdf;
}

export async function generateResearchPDF(data: ResearchReportData): Promise<void> {
  buildResearchPDF(data).save(`youtube-research-${safeExportStem(data.query)}.pdf`);
}
