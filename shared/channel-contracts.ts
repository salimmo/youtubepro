import { z } from "zod";

// Vertrag für die Kanalanalyse: Kanal auflösen, Uploads laden, Outlier-Werte
// berechnen. Wird von Server (Validierung) und Client (Typen) verwendet.

export const channelAnalysisRequestSchema = z.object({
  // Handle (@name), Kanal-ID (UC…), Kanal-URL oder Benutzername.
  channel: z.string().trim().min(2).max(300),
  maxVideos: z.coerce.number().int().min(10).max(200).default(100),
  refresh: z.coerce.boolean().optional().default(false),
});
export type ChannelAnalysisRequest = z.infer<typeof channelAnalysisRequestSchema>;

export interface ChannelSummary {
  id: string;
  title: string;
  handle: string | null;
  customUrl: string | null;
  description: string;
  thumbnailUrl: string | null;
  bannerUrl: string | null;
  country: string | null;
  publishedAt: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
  videoCount: number | null;
  viewCount: number | null;
  defaultLanguage: string | null;
  url: string;
}

export interface ChannelVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  url: string;
  duration: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  defaultLanguage: string | null;
  defaultAudioLanguage: string | null;
  liveBroadcastContent: string | null;
  ageDays: number;
  viewsPerDay: number | null;
  // Aufrufe geteilt durch den Median der analysierten Kanalvideos (wie 1of10).
  outlierScore: number | null;
  // Aufrufe pro Tag geteilt durch den Median der Aufrufe pro Tag (altersbereinigt).
  velocityScore: number | null;
}

export interface ChannelStats {
  analyzedVideos: number;
  medianViews: number | null;
  meanViews: number | null;
  medianViewsPerDay: number | null;
  totalViewsAnalyzed: number;
  // Unter 10 analysierten Videos sind Outlier-Werte statistisch wenig belastbar.
  lowConfidence: boolean;
  oldestAnalyzedAt: string | null;
  newestAnalyzedAt: string | null;
}

export interface ChannelAnalysisResponse {
  channel: ChannelSummary;
  videos: ChannelVideo[];
  stats: ChannelStats;
  retrievedAt: string;
  cached: boolean;
  warnings: string[];
}
