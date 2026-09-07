import type { Video, SearchFilters, SearchResponse } from "@shared/schema";
import { UploadDateFilter, DurationFilter, SortBy, LanguageFilter } from "@shared/schema";
import { createHash } from "node:crypto";
import { ProviderError } from "./provider-errors";
import { ageInDays, getChannelBaselines, outlierScore } from "./youtube-channel";

const BASE_URL = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_TIMEOUT_MS = 15_000;

if (!process.env.YOUTUBE_API_KEY) {
  console.warn("Warning: YOUTUBE_API_KEY is not set. YouTube search will not work.");
}

function getPublishedAfter(uploadDate: UploadDateFilter): string | undefined {
  const now = new Date();

  switch (uploadDate) {
    case UploadDateFilter.HOUR:
      now.setHours(now.getHours() - 1);
      return now.toISOString();
    case UploadDateFilter.TODAY:
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    case UploadDateFilter.WEEK:
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    case UploadDateFilter.MONTH:
      now.setMonth(now.getMonth() - 1);
      return now.toISOString();
    case UploadDateFilter.YEAR:
      now.setFullYear(now.getFullYear() - 1);
      return now.toISOString();
    default:
      return undefined;
  }
}

function getVideoDuration(duration: DurationFilter): string | undefined {
  switch (duration) {
    case DurationFilter.SHORT:
      return "short";
    case DurationFilter.MEDIUM:
      return "medium";
    case DurationFilter.LONG:
      return "long";
    default:
      return undefined;
  }
}

function getOrderBy(sortBy: SortBy): string {
  switch (sortBy) {
    case SortBy.DATE:
      return "date";
    case SortBy.VIEW_COUNT:
      return "viewCount";
    case SortBy.RATING:
      return "rating";
    case SortBy.OUTLIER:
      // Outlier wird nach der Anreicherung serverseitig sortiert; YouTube
      // liefert dafür die relevantesten Treffer.
      return "relevance";
    default:
      return "relevance";
  }
}

function parseOptionalCount(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getYouTubeErrorReason(body: any): string {
  return [
    body?.error?.message,
    ...(Array.isArray(body?.error?.errors)
      ? body.error.errors.flatMap((entry: any) => [entry?.reason, entry?.message])
      : []),
  ].filter((value): value is string => typeof value === "string").join(" ");
}

function youtubeHttpError(status: number, body: unknown, stage: string): ProviderError {
  const reason = getYouTubeErrorReason(body).toLowerCase();
  const invalidKey = status === 401
    || reason.includes("keyinvalid")
    || reason.includes("api key not valid")
    || reason.includes("invalid api key");
  const quota = status === 429
    || reason.includes("quota")
    || reason.includes("dailylimit")
    || reason.includes("rate limit");

  if (invalidKey) {
    return new ProviderError({
      message: `YouTube hat den API-Schlüssel abgelehnt (Schritt: ${stage}).`,
      category: "invalid_key",
      code: "YOUTUBE_INVALID_KEY",
      status: 401,
      retryable: false,
    });
  }
  if (quota) {
    return new ProviderError({
      message: `YouTube-Kontingent nicht verfügbar (Schritt: ${stage}).`,
      category: "quota",
      code: "YOUTUBE_QUOTA",
      status: 429,
      retryable: true,
    });
  }
  if (status >= 500) {
    return new ProviderError({
      message: `YouTube hat einen Serverfehler zurückgegeben (Schritt: ${stage}).`,
      category: "provider_server",
      code: "YOUTUBE_PROVIDER_SERVER",
      status: 500,
      retryable: true,
    });
  }
  return new ProviderError({
    message: `YouTube hat die Anfrage abgelehnt (Schritt: ${stage}).`,
    category: "unknown",
    code: "YOUTUBE_REQUEST_REJECTED",
    status: 500,
    retryable: false,
  });
}

async function fetchYouTubeJson(url: string, stage: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new ProviderError({
        message: `YouTube hat fehlerhaftes JSON zurückgegeben (Schritt: ${stage}).`,
        category: "invalid_response",
        code: "YOUTUBE_INVALID_RESPONSE",
        status: 500,
        retryable: false,
        cause: error,
      });
    }
    if (!response.ok) throw youtubeHttpError(response.status, body, stage);
    return body;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError({
        message: `Zeitüberschreitung bei YouTube (Schritt: ${stage}).`,
        category: "timeout",
        code: "YOUTUBE_TIMEOUT",
        status: 500,
        retryable: true,
        cause: error,
      });
    }
    throw new ProviderError({
      message: `YouTube war nicht erreichbar (Schritt: ${stage}).`,
      category: "network",
      code: "YOUTUBE_NETWORK",
      status: 500,
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createSnapshotId(filters: SearchFilters, orderedVideoIds: string[], retrievedAt: string): string {
  const identity = JSON.stringify({
    query: filters.query.trim(),
    uploadDate: filters.uploadDate,
    duration: filters.duration,
    sortBy: filters.sortBy,
    language: filters.language,
    maxResults: filters.maxResults,
    orderedVideoIds,
    retrievedAt,
  });
  return `yt_${createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
}

export async function searchVideos(filters: SearchFilters): Promise<SearchResponse> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    throw new ProviderError({
      message: "YouTube-API-Schlüssel ist nicht konfiguriert.",
      category: "missing_key",
      code: "YOUTUBE_MISSING_KEY",
      status: 503,
      retryable: false,
    });
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: filters.query,
    type: "video",
    maxResults: String(filters.maxResults || 25),
    key: apiKey,
    order: getOrderBy(filters.sortBy),
  });

  const publishedAfter = getPublishedAfter(filters.uploadDate);
  if (publishedAfter) {
    params.set("publishedAfter", publishedAfter);
  }

  const videoDuration = getVideoDuration(filters.duration);
  if (videoDuration) {
    params.set("videoDuration", videoDuration);
  }

  // Sprachpräferenz: YouTube bevorzugt dann Videos in dieser Sprache. Da viele
  // Videos keine Sprachangabe tragen, ist das eine Gewichtung, kein harter Filter.
  if (filters.language && filters.language !== LanguageFilter.ANY) {
    params.set("relevanceLanguage", filters.language);
    params.set("regionCode", filters.language === LanguageFilter.GERMAN ? "DE" : "US");
  }

  const searchUrl = `${BASE_URL}/search?${params}`;
  const searchData = await fetchYouTubeJson(searchUrl, "Suche");
  const retrievedAt = new Date().toISOString();
  const warnings: SearchResponse["warnings"] = [];
  if (!Array.isArray(searchData.items)) {
    throw new ProviderError({
      message: "YouTube hat eine ungültige Suchantwort zurückgegeben.",
      category: "invalid_response",
      code: "YOUTUBE_INVALID_RESPONSE",
      status: 500,
      retryable: false,
    });
  }

  if (searchData.items.length === 0) {
    const orderedVideoIds: string[] = [];
    return {
      videos: [],
      totalResults: 0,
      resultsPerPage: 0,
      regionCode: typeof searchData.regionCode === "string" ? searchData.regionCode : undefined,
      snapshotId: createSnapshotId(filters, orderedVideoIds, retrievedAt),
      retrievedAt,
      totalResultsIsApproximate: true,
      provenance: {
        provider: "youtube-data-api-v3",
        query: filters.query.trim(),
        filters: {
          uploadDate: filters.uploadDate,
          duration: filters.duration,
          sortBy: filters.sortBy,
          language: filters.language,
          maxResults: filters.maxResults,
        },
        orderedVideoIds,
      },
      enrichment: {
        search: { status: "complete", requested: filters.maxResults, returned: 0 },
        videoDetails: { status: "skipped", requested: 0, returned: 0 },
        channels: { status: "skipped", requested: 0, returned: 0 },
      },
      warnings,
    };
  }

  const orderedVideoIds: string[] = searchData.items
    .map((item: any) => item.id?.videoId)
    .filter((id: unknown): id is string => typeof id === "string");
  if (orderedVideoIds.length !== searchData.items.length) {
    warnings.push({
      code: "SEARCH_ITEMS_OMITTED",
      stage: "search",
      message: "Einige Suchergebnisse enthielten keine öffentliche Video-ID und wurden ausgelassen.",
    });
  }
  if (orderedVideoIds.length === 0) {
    return {
      videos: [],
      totalResults: parseOptionalCount(searchData.pageInfo?.totalResults) ?? 0,
      resultsPerPage: parseOptionalCount(searchData.pageInfo?.resultsPerPage) ?? 0,
      regionCode: typeof searchData.regionCode === "string" ? searchData.regionCode : undefined,
      snapshotId: createSnapshotId(filters, orderedVideoIds, retrievedAt),
      retrievedAt,
      totalResultsIsApproximate: true,
      provenance: {
        provider: "youtube-data-api-v3",
        query: filters.query.trim(),
        filters: {
          uploadDate: filters.uploadDate,
          duration: filters.duration,
          sortBy: filters.sortBy,
          language: filters.language,
          maxResults: filters.maxResults,
        },
        orderedVideoIds,
      },
      enrichment: {
        search: { status: "partial", requested: filters.maxResults, returned: 0 },
        videoDetails: { status: "skipped", requested: 0, returned: 0 },
        channels: { status: "skipped", requested: 0, returned: 0 },
      },
      warnings,
    };
  }
  const videoIds = orderedVideoIds.join(",");

  const detailsParams = new URLSearchParams({
    part: "snippet,statistics,contentDetails,status,topicDetails,paidProductPlacementDetails,liveStreamingDetails",
    id: videoIds,
    key: apiKey,
  });

  const detailsUrl = `${BASE_URL}/videos?${detailsParams}`;
  const detailsData = await fetchYouTubeJson(detailsUrl, "Videodetails");
  if (!Array.isArray(detailsData.items)) {
    throw new ProviderError({
      message: "YouTube hat eine ungültige Videodetails-Antwort zurückgegeben.",
      category: "invalid_response",
      code: "YOUTUBE_INVALID_RESPONSE",
      status: 500,
      retryable: false,
    });
  }
  if (detailsData.items.length !== orderedVideoIds.length) {
    warnings.push({
      code: "VIDEO_DETAILS_PARTIAL",
      stage: "video_details",
      message: "Für einige Suchergebnisse waren keine öffentlichen Videodetails mehr verfügbar; sie wurden ausgelassen.",
    });
  }
  const channelIds = Array.from(new Set(
    detailsData.items
      .map((item: any) => item.snippet?.channelId)
      .filter((id: unknown): id is string => typeof id === "string"),
  ));

  const channelDetails = new Map<string, any>();
  let channelStatus: "complete" | "partial" | "skipped" = channelIds.length > 0 ? "complete" : "skipped";
  if (channelIds.length > 0) {
    const channelParams = new URLSearchParams({
      part: "snippet,statistics,topicDetails,brandingSettings,contentDetails",
      id: channelIds.join(","),
      maxResults: "50",
      key: apiKey,
    });

    try {
      const channelData = await fetchYouTubeJson(`${BASE_URL}/channels?${channelParams}`, "Kanal-Anreicherung");
      for (const channel of Array.isArray(channelData.items) ? channelData.items : []) {
        channelDetails.set(channel.id, channel);
      }
      if (channelDetails.size !== channelIds.length) channelStatus = "partial";
    } catch {
      channelStatus = "partial";
    }
    if (channelStatus === "partial") {
      warnings.push({
        code: "CHANNEL_ENRICHMENT_PARTIAL",
        stage: "channel_enrichment",
        message: "Öffentliche Kanal-Metadaten waren für einige oder alle Videos nicht verfügbar.",
      });
    }
  }

  const detailsById = new Map<string, any>(
    detailsData.items.map((item: any) => [item.id, item]),
  );

  // Outlier-Baseline je Kanal (Median der letzten Uploads). Aus dem Cache oder
  // mit 2 Kontingent-Einheiten je Kanal nachgeladen; Fehler sind nicht fatal.
  const uploadsPlaylists = new Map<string, string>();
  channelDetails.forEach((channel, channelId) => {
    const playlistId = channel?.contentDetails?.relatedPlaylists?.uploads;
    if (typeof playlistId === "string") uploadsPlaylists.set(channelId, playlistId);
  });
  const baselines = await getChannelBaselines(uploadsPlaylists, apiKey);
  if (uploadsPlaylists.size > 0 && baselines.size < uploadsPlaylists.size) {
    warnings.push({
      code: "OUTLIER_BASELINE_PARTIAL",
      stage: "channel_enrichment",
      message: "Für einige Kanäle konnte kein Vergleichswert für den Outlier-Wert ermittelt werden.",
    });
  }
  const now = Date.now();

  let videos: Video[] = orderedVideoIds.flatMap((id) => {
    const item = detailsById.get(id);
    if (!item) return [];
    const channel = channelDetails.get(item.snippet.channelId);
    const channelStats = channel?.statistics;
    const baseline = baselines.get(item.snippet.channelId);
    const viewCount = parseOptionalCount(item.statistics?.viewCount);
    const viewsPerDay = viewCount === undefined ? undefined : Math.round((viewCount / ageInDays(item.snippet.publishedAt, now)) * 10) / 10;
    const score = outlierScore(viewCount ?? null, baseline?.medianViews ?? null);
    const velocity = outlierScore(viewsPerDay ?? null, baseline?.medianViewsPerDay ?? null);

    return [{
      outlierScore: score ?? undefined,
      velocityScore: velocity ?? undefined,
      channelMedianViews: baseline?.medianViews ?? undefined,
      channelSampleSize: baseline?.sampleSize,
      viewsPerDay,
      id: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails?.maxres?.url
        || item.snippet.thumbnails?.standard?.url
        || item.snippet.thumbnails?.high?.url
        || item.snippet.thumbnails?.medium?.url
        || item.snippet.thumbnails?.default?.url,
      description: item.snippet.description,
      viewCount: parseOptionalCount(item.statistics?.viewCount),
      likeCount: parseOptionalCount(item.statistics?.likeCount),
      commentCount: parseOptionalCount(item.statistics?.commentCount),
      duration: item.contentDetails?.duration,
      tags: item.snippet.tags,
      categoryId: item.snippet.categoryId,
      liveBroadcastContent: item.snippet.liveBroadcastContent,
      defaultLanguage: item.snippet.defaultLanguage,
      defaultAudioLanguage: item.snippet.defaultAudioLanguage,
      definition: item.contentDetails?.definition,
      hasCaptions: item.contentDetails?.caption === "true"
        ? true
        : item.contentDetails?.caption === "false"
          ? false
          : undefined,
      licensedContent: item.contentDetails?.licensedContent,
      embeddable: item.status?.embeddable,
      madeForKids: item.status?.madeForKids,
      hasPaidProductPlacement: item.paidProductPlacementDetails?.hasPaidProductPlacement,
      topicCategories: item.topicDetails?.topicCategories,
      liveStreamingDetails: item.liveStreamingDetails ? {
        actualStartTime: item.liveStreamingDetails.actualStartTime,
        actualEndTime: item.liveStreamingDetails.actualEndTime,
        scheduledStartTime: item.liveStreamingDetails.scheduledStartTime,
        concurrentViewers: parseOptionalCount(item.liveStreamingDetails.concurrentViewers),
      } : undefined,
      channelStatistics: channel ? {
        subscriberCount: channelStats?.hiddenSubscriberCount
          ? undefined
          : parseOptionalCount(channelStats?.subscriberCount),
        hiddenSubscriberCount: Boolean(channelStats?.hiddenSubscriberCount),
        videoCount: parseOptionalCount(channelStats?.videoCount),
        viewCount: parseOptionalCount(channelStats?.viewCount),
        publishedAt: channel.snippet?.publishedAt,
        country: channel.snippet?.country,
        thumbnailUrl: channel.snippet?.thumbnails?.default?.url,
        description: channel.snippet?.description,
        customUrl: channel.snippet?.customUrl,
        defaultLanguage: channel.brandingSettings?.channel?.defaultLanguage,
        keywords: channel.brandingSettings?.channel?.keywords,
        topicCategories: channel.topicDetails?.topicCategories,
      } : undefined,
    }];
  });

  // Sprachfilter: Videos mit bekannter, abweichender Sprache entfernen.
  // Videos ohne Sprachangabe bleiben, weil YouTube sie bereits nach
  // Sprachpräferenz gewichtet hat.
  if (filters.language && filters.language !== LanguageFilter.ANY) {
    const wanted = filters.language;
    const before = videos.length;
    videos = videos.filter((video) => {
      const language = (video.defaultAudioLanguage || video.defaultLanguage || "").toLowerCase();
      return !language || language.startsWith(wanted);
    });
    if (videos.length < before) {
      warnings.push({
        code: "LANGUAGE_FILTERED",
        stage: "video_details",
        message: `${before - videos.length} Videos mit anderer Sprachangabe wurden ausgeblendet.`,
      });
    }
  }

  if (filters.sortBy === SortBy.OUTLIER) {
    videos = [...videos].sort((left, right) => (right.outlierScore ?? -1) - (left.outlierScore ?? -1));
  }
  const finalOrderedIds = videos.map((video) => video.id);

  return {
    videos,
    totalResults: searchData.pageInfo?.totalResults || videos.length,
    nextPageToken: searchData.nextPageToken,
    resultsPerPage: searchData.pageInfo?.resultsPerPage || videos.length,
    regionCode: searchData.regionCode,
    snapshotId: createSnapshotId(filters, finalOrderedIds, retrievedAt),
    retrievedAt,
    totalResultsIsApproximate: true,
    provenance: {
      provider: "youtube-data-api-v3",
      query: filters.query.trim(),
      filters: {
        uploadDate: filters.uploadDate,
        duration: filters.duration,
        sortBy: filters.sortBy,
        language: filters.language,
        maxResults: filters.maxResults,
      },
      orderedVideoIds: finalOrderedIds,
    },
    enrichment: {
      search: { status: "complete", requested: filters.maxResults, returned: orderedVideoIds.length },
      videoDetails: {
        status: detailsData.items.length === orderedVideoIds.length ? "complete" : "partial",
        requested: orderedVideoIds.length,
        returned: detailsData.items.length,
      },
      channels: {
        status: channelStatus,
        requested: channelIds.length,
        returned: channelDetails.size,
      },
    },
    warnings,
  };
}
