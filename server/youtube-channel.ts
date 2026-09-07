import type {
  ChannelAnalysisRequest,
  ChannelAnalysisResponse,
  ChannelStats,
  ChannelSummary,
  ChannelVideo,
} from "@shared/channel-contracts";
import { ProviderError } from "./provider-errors";
import { isDatabaseReady, query } from "./db";

// Kanalanalyse über die YouTube Data API v3.
//
// Kontingent (Stand der API-Dokumentation): channels.list 1, playlistItems.list 1,
// videos.list 1 je Aufruf, search.list 100. Ein Kanal mit 100 Videos kostet
// damit rund 5 Einheiten; nur wenn ein Klartextname nicht auflösbar ist, fällt
// eine Suche (100 Einheiten) an.

const BASE_URL = "https://www.googleapis.com/youtube/v3";
const TIMEOUT_MS = 15_000;
const CHANNEL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const BASELINE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BASELINE_SAMPLE = 30;
const MIN_CONFIDENT_SAMPLE = 10;

function requireApiKey(): string {
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
  return apiKey;
}

function toNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function reasonOf(body: any): string {
  return [
    body?.error?.message,
    ...(Array.isArray(body?.error?.errors) ? body.error.errors.flatMap((entry: any) => [entry?.reason, entry?.message]) : []),
  ].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
}

async function fetchJson(url: string, stage: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    let body: any;
    try {
      body = await response.json();
    } catch (error) {
      throw new ProviderError({ message: `YouTube hat fehlerhaftes JSON zurückgegeben (Schritt: ${stage}).`, category: "invalid_response", code: "YOUTUBE_INVALID_RESPONSE", status: 500, retryable: false, cause: error });
    }
    if (!response.ok) {
      const reason = reasonOf(body);
      if (response.status === 401 || reason.includes("keyinvalid") || reason.includes("api key not valid")) {
        throw new ProviderError({ message: `YouTube hat den API-Schlüssel abgelehnt (Schritt: ${stage}).`, category: "invalid_key", code: "YOUTUBE_INVALID_KEY", status: 401, retryable: false });
      }
      if (response.status === 429 || reason.includes("quota") || reason.includes("dailylimit")) {
        throw new ProviderError({ message: `YouTube-Kontingent nicht verfügbar (Schritt: ${stage}).`, category: "quota", code: "YOUTUBE_QUOTA", status: 429, retryable: true });
      }
      if (response.status >= 500) {
        throw new ProviderError({ message: `YouTube hat einen Serverfehler zurückgegeben (Schritt: ${stage}).`, category: "provider_server", code: "YOUTUBE_SERVER", status: 500, retryable: true });
      }
      throw new ProviderError({ message: `YouTube hat die Anfrage abgelehnt (Schritt: ${stage}, Status ${response.status}).`, category: "invalid_response", code: "YOUTUBE_REJECTED", status: 500, retryable: false });
    }
    return body;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError({ message: `Zeitüberschreitung bei YouTube (Schritt: ${stage}).`, category: "timeout", code: "YOUTUBE_TIMEOUT", status: 500, retryable: true, cause: error });
    }
    throw new ProviderError({ message: `YouTube war nicht erreichbar (Schritt: ${stage}).`, category: "network", code: "YOUTUBE_NETWORK", status: 500, retryable: true, cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- Statistik ----------

export function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function mean(values: number[]): number | null {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function ageInDays(publishedAt: string, now = Date.now()): number {
  const published = new Date(publishedAt).getTime();
  if (!Number.isFinite(published)) return 1;
  return Math.max(1, (now - published) / (24 * 60 * 60 * 1000));
}

export function outlierScore(views: number | null, baseline: number | null): number | null {
  if (views == null || baseline == null || baseline <= 0) return null;
  return Math.round((views / baseline) * 10) / 10;
}

// ---------- Kanal auflösen ----------

export interface ChannelReference {
  kind: "handle" | "id" | "username" | "query";
  value: string;
}

export function parseChannelReference(input: string): ChannelReference {
  const trimmed = input.trim();
  const urlMatch = /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(.+)$/i.exec(trimmed);
  const path = urlMatch ? urlMatch[1].split(/[?#]/)[0].replace(/\/+$/, "") : trimmed;
  // Bei URLs zählt nur das erste Pfadsegment (z. B. /@handle/videos).
  const firstSegment = path.split("/")[0];
  if (/^@[\w.-]{3,}$/.test(firstSegment)) return { kind: "handle", value: firstSegment.slice(1) };
  if (/^UC[\w-]{20,}$/.test(path)) return { kind: "id", value: path };
  const channelPath = /^channel\/(UC[\w-]{20,})/i.exec(path);
  if (channelPath) return { kind: "id", value: channelPath[1] };
  const userPath = /^user\/([\w.-]+)/i.exec(path);
  if (userPath) return { kind: "username", value: userPath[1] };
  const customPath = /^c\/([\w.-]+)/i.exec(path);
  if (customPath) return { kind: "query", value: customPath[1] };
  if (/^[\w.-]{3,}$/.test(path) && !path.includes(" ")) return { kind: "handle", value: path };
  return { kind: "query", value: path };
}

async function fetchChannelItem(reference: ChannelReference, apiKey: string): Promise<any | null> {
  const params = new URLSearchParams({ part: "snippet,statistics,contentDetails,brandingSettings", key: apiKey });
  if (reference.kind === "handle") params.set("forHandle", reference.value);
  else if (reference.kind === "id") params.set("id", reference.value);
  else if (reference.kind === "username") params.set("forUsername", reference.value);
  else return null;
  const data = await fetchJson(`${BASE_URL}/channels?${params}`, "Kanal auflösen");
  return Array.isArray(data.items) && data.items[0] ? data.items[0] : null;
}

async function resolveChannelItem(input: string, apiKey: string, warnings: string[]): Promise<any> {
  const reference = parseChannelReference(input);
  let item = await fetchChannelItem(reference, apiKey);
  if (!item && reference.kind === "handle") {
    // Manche Kanäle sind nur als Benutzername auflösbar.
    item = await fetchChannelItem({ kind: "username", value: reference.value }, apiKey);
  }
  if (!item) {
    // Letzter Ausweg: Kanalsuche (kostet 100 Einheiten).
    const searchParams = new URLSearchParams({ part: "snippet", type: "channel", maxResults: "1", q: reference.value, key: apiKey });
    const search = await fetchJson(`${BASE_URL}/search?${searchParams}`, "Kanalsuche");
    const channelId = search?.items?.[0]?.id?.channelId ?? search?.items?.[0]?.snippet?.channelId;
    if (typeof channelId === "string") {
      warnings.push(`„${input.trim()}“ wurde nicht direkt gefunden. Es wurde der bestpassende Kanal aus der YouTube-Suche verwendet.`);
      item = await fetchChannelItem({ kind: "id", value: channelId }, apiKey);
    }
  }
  if (!item) {
    throw new ProviderError({
      message: `Kein YouTube-Kanal für „${input.trim()}“ gefunden.`,
      category: "invalid_response",
      code: "YOUTUBE_CHANNEL_NOT_FOUND",
      status: 404,
      retryable: false,
    });
  }
  return item;
}

function toChannelSummary(item: any): ChannelSummary {
  const stats = item.statistics ?? {};
  const customUrl: string | null = typeof item.snippet?.customUrl === "string" ? item.snippet.customUrl : null;
  const handle = customUrl && customUrl.startsWith("@") ? customUrl : null;
  return {
    id: item.id,
    title: item.snippet?.title ?? "",
    handle,
    customUrl,
    description: item.snippet?.description ?? "",
    thumbnailUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    bannerUrl: item.brandingSettings?.image?.bannerExternalUrl ?? null,
    country: item.snippet?.country ?? null,
    publishedAt: item.snippet?.publishedAt ?? null,
    subscriberCount: stats.hiddenSubscriberCount ? null : toNumber(stats.subscriberCount),
    hiddenSubscriberCount: Boolean(stats.hiddenSubscriberCount),
    videoCount: toNumber(stats.videoCount),
    viewCount: toNumber(stats.viewCount),
    defaultLanguage: item.brandingSettings?.channel?.defaultLanguage ?? null,
    url: handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${item.id}`,
  };
}

// ---------- Uploads laden ----------

async function fetchUploadIds(uploadsPlaylistId: string, maxVideos: number, apiKey: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < maxVideos) {
    const params = new URLSearchParams({
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(50, maxVideos - ids.length)),
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await fetchJson(`${BASE_URL}/playlistItems?${params}`, "Uploads laden");
    for (const item of Array.isArray(data.items) ? data.items : []) {
      const videoId = item?.contentDetails?.videoId;
      if (typeof videoId === "string") ids.push(videoId);
    }
    pageToken = typeof data.nextPageToken === "string" ? data.nextPageToken : undefined;
    if (!pageToken) break;
  }
  return ids.slice(0, maxVideos);
}

async function fetchVideoItems(videoIds: string[], apiKey: string): Promise<any[]> {
  const items: any[] = [];
  for (let index = 0; index < videoIds.length; index += 50) {
    const batch = videoIds.slice(index, index + 50);
    const params = new URLSearchParams({ part: "snippet,statistics,contentDetails", id: batch.join(","), key: apiKey });
    const data = await fetchJson(`${BASE_URL}/videos?${params}`, "Videodetails");
    if (Array.isArray(data.items)) items.push(...data.items);
  }
  return items;
}

function toChannelVideo(item: any, now: number): Omit<ChannelVideo, "outlierScore" | "velocityScore"> {
  const publishedAt: string = item.snippet?.publishedAt ?? new Date(0).toISOString();
  const viewCount = toNumber(item.statistics?.viewCount);
  const days = ageInDays(publishedAt, now);
  return {
    id: item.id,
    title: item.snippet?.title ?? "",
    description: (item.snippet?.description ?? "").slice(0, 500),
    publishedAt,
    thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    duration: item.contentDetails?.duration ?? null,
    viewCount,
    likeCount: toNumber(item.statistics?.likeCount),
    commentCount: toNumber(item.statistics?.commentCount),
    defaultLanguage: item.snippet?.defaultLanguage ?? null,
    defaultAudioLanguage: item.snippet?.defaultAudioLanguage ?? null,
    liveBroadcastContent: item.snippet?.liveBroadcastContent ?? null,
    ageDays: Math.round(days),
    viewsPerDay: viewCount == null ? null : Math.round((viewCount / days) * 10) / 10,
  };
}

export function computeChannelStats(videos: Array<{ viewCount: number | null; viewsPerDay: number | null; publishedAt: string }>): ChannelStats {
  const views = videos.map((video) => video.viewCount).filter((value): value is number => value != null);
  const perDay = videos.map((video) => video.viewsPerDay).filter((value): value is number => value != null);
  const dates = videos.map((video) => video.publishedAt).sort();
  return {
    analyzedVideos: videos.length,
    medianViews: median(views),
    meanViews: mean(views) == null ? null : Math.round(mean(views) as number),
    medianViewsPerDay: median(perDay),
    totalViewsAnalyzed: views.reduce((sum, value) => sum + value, 0),
    lowConfidence: views.length < MIN_CONFIDENT_SAMPLE,
    oldestAnalyzedAt: dates[0] ?? null,
    newestAnalyzedAt: dates[dates.length - 1] ?? null,
  };
}

export function scoreVideos<T extends { viewCount: number | null; viewsPerDay: number | null }>(
  videos: T[],
  stats: Pick<ChannelStats, "medianViews" | "medianViewsPerDay">,
): Array<T & { outlierScore: number | null; velocityScore: number | null }> {
  return videos.map((video) => ({
    ...video,
    outlierScore: outlierScore(video.viewCount, stats.medianViews),
    velocityScore: outlierScore(video.viewsPerDay, stats.medianViewsPerDay),
  }));
}

// ---------- Cache ----------

async function readChannelCache(key: string): Promise<ChannelAnalysisResponse | null> {
  if (!isDatabaseReady()) return null;
  try {
    const result = await query<{ payload: ChannelAnalysisResponse; fetched_at: Date }>(
      "SELECT payload, fetched_at FROM channel_cache WHERE cache_key = $1",
      [key],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (Date.now() - new Date(row.fetched_at).getTime() > CHANNEL_CACHE_TTL_MS) return null;
    return { ...row.payload, cached: true };
  } catch (error: any) {
    console.error("Channel cache read failed:", error?.message || error);
    return null;
  }
}

async function writeChannelCache(key: string, channelId: string, payload: ChannelAnalysisResponse): Promise<void> {
  if (!isDatabaseReady()) return;
  try {
    await query(
      `INSERT INTO channel_cache (cache_key, channel_id, fetched_at, payload) VALUES ($1, $2, now(), $3::jsonb)
       ON CONFLICT (cache_key) DO UPDATE SET channel_id = EXCLUDED.channel_id, fetched_at = now(), payload = EXCLUDED.payload`,
      [key, channelId, JSON.stringify(payload)],
    );
  } catch (error: any) {
    console.error("Channel cache write failed:", error?.message || error);
  }
}

// ---------- Öffentliche API ----------

export async function analyzeChannel(request: ChannelAnalysisRequest): Promise<ChannelAnalysisResponse> {
  const apiKey = requireApiKey();
  const warnings: string[] = [];
  const cacheKey = `${request.channel.trim().toLowerCase()}|${request.maxVideos}`;
  if (!request.refresh) {
    const cached = await readChannelCache(cacheKey);
    if (cached) return cached;
  }

  const channelItem = await resolveChannelItem(request.channel, apiKey, warnings);
  const channel = toChannelSummary(channelItem);
  const uploadsPlaylistId: string | undefined = channelItem.contentDetails?.relatedPlaylists?.uploads;
  const now = Date.now();
  let scored: ChannelVideo[] = [];
  if (uploadsPlaylistId) {
    const ids = await fetchUploadIds(uploadsPlaylistId, request.maxVideos, apiKey);
    const items = await fetchVideoItems(ids, apiKey);
    const base = items.map((item) => toChannelVideo(item, now));
    const stats = computeChannelStats(base);
    scored = scoreVideos(base, stats).sort((left, right) => (right.viewCount ?? 0) - (left.viewCount ?? 0));
    if (items.length < ids.length) warnings.push("Für einige Uploads waren keine öffentlichen Videodetails verfügbar; sie wurden ausgelassen.");
  } else {
    warnings.push("Der Kanal hat keine öffentliche Upload-Liste.");
  }
  const stats = computeChannelStats(scored);
  if (stats.lowConfidence) {
    warnings.push(`Nur ${stats.analyzedVideos} Videos analysiert. Outlier-Werte sind bei so kleinen Kanälen wenig aussagekräftig.`);
  }
  const response: ChannelAnalysisResponse = {
    channel,
    videos: scored,
    stats,
    retrievedAt: new Date(now).toISOString(),
    cached: false,
    warnings,
  };
  await writeChannelCache(cacheKey, channel.id, response);
  await writeChannelCache(`id:${channel.id}|${request.maxVideos}`, channel.id, response);
  return response;
}

// ---------- Kanal-Baseline für die Recherche ----------

export interface ChannelBaseline {
  channelId: string;
  medianViews: number | null;
  medianViewsPerDay: number | null;
  sampleSize: number;
}

async function readBaselines(channelIds: string[]): Promise<Map<string, ChannelBaseline>> {
  const found = new Map<string, ChannelBaseline>();
  if (!isDatabaseReady() || channelIds.length === 0) return found;
  try {
    const result = await query<{ channel_id: string; median_views: number | null; median_views_per_day: number | null; sample_size: number; fetched_at: Date }>(
      "SELECT channel_id, median_views, median_views_per_day, sample_size, fetched_at FROM channel_baseline WHERE channel_id = ANY($1::text[])",
      [channelIds],
    );
    for (const row of result.rows) {
      if (Date.now() - new Date(row.fetched_at).getTime() > BASELINE_CACHE_TTL_MS) continue;
      found.set(row.channel_id, {
        channelId: row.channel_id,
        medianViews: row.median_views == null ? null : Number(row.median_views),
        medianViewsPerDay: row.median_views_per_day == null ? null : Number(row.median_views_per_day),
        sampleSize: Number(row.sample_size),
      });
    }
  } catch (error: any) {
    console.error("Baseline cache read failed:", error?.message || error);
  }
  return found;
}

async function writeBaseline(baseline: ChannelBaseline): Promise<void> {
  if (!isDatabaseReady()) return;
  try {
    await query(
      `INSERT INTO channel_baseline (channel_id, median_views, median_views_per_day, sample_size, fetched_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (channel_id) DO UPDATE SET median_views = EXCLUDED.median_views, median_views_per_day = EXCLUDED.median_views_per_day,
         sample_size = EXCLUDED.sample_size, fetched_at = now()`,
      [baseline.channelId, baseline.medianViews, baseline.medianViewsPerDay, baseline.sampleSize],
    );
  } catch (error: any) {
    console.error("Baseline cache write failed:", error?.message || error);
  }
}

// Liefert je Kanal den Median der letzten Uploads. `uploadsPlaylistIds` kommt
// aus channels.list (contentDetails.relatedPlaylists.uploads), damit hier
// keine zusätzliche Kanalabfrage nötig ist.
export async function getChannelBaselines(
  uploadsPlaylistIds: Map<string, string>,
  apiKey: string,
): Promise<Map<string, ChannelBaseline>> {
  const channelIds = Array.from(uploadsPlaylistIds.keys());
  const baselines = await readBaselines(channelIds);
  const missing = channelIds.filter((id) => !baselines.has(id));
  const now = Date.now();
  await Promise.all(missing.map(async (channelId) => {
    const playlistId = uploadsPlaylistIds.get(channelId);
    if (!playlistId) return;
    try {
      const ids = await fetchUploadIds(playlistId, BASELINE_SAMPLE, apiKey);
      const items = await fetchVideoItems(ids, apiKey);
      const stats = computeChannelStats(items.map((item) => toChannelVideo(item, now)));
      const baseline: ChannelBaseline = {
        channelId,
        medianViews: stats.medianViews,
        medianViewsPerDay: stats.medianViewsPerDay,
        sampleSize: stats.analyzedVideos,
      };
      baselines.set(channelId, baseline);
      await writeBaseline(baseline);
    } catch (error: any) {
      // Baseline ist optional; die Suche darf daran nicht scheitern.
      console.warn(`Baseline for channel ${channelId} unavailable:`, error?.message || error);
    }
  }));
  return baselines;
}
