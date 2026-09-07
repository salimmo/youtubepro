import type { Video } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, ThumbsUp, MessageSquare, Calendar, Clock, ExternalLink, Tag, Sparkles, Zap, Activity } from "lucide-react";
import { formatCompact, intlLocale, useI18n, type TranslateVars, type UiLanguage } from "@/lib/i18n";

type Translate = (key: string, vars?: TranslateVars) => string;

interface VideoDetailDialogProps {
  video: Video | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatViews(language: UiLanguage, views?: number): string {
  return formatCompact(language, views);
}

function formatDate(language: UiLanguage, dateString: string): string {
  return new Date(dateString).toLocaleDateString(intlLocale(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRatio(language: UiLanguage, value: number): string {
  return `${value.toLocaleString(intlLocale(language), { maximumFractionDigits: 1 })}x`;
}

function formatDuration(t: Translate, duration?: string): string {
  if (!duration) return t("common.notAvailable");
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;

  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;

  if (hours > 0) {
    return t("video.durationHms", { hours, minutes, seconds });
  }
  return t("video.durationMs", { minutes, seconds });
}

export function VideoDetailDialog({ video, open, onOpenChange }: VideoDetailDialogProps) {
  const { t, language } = useI18n();
  if (!video) return null;

  const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;
  const channelUrl = `https://www.youtube.com/channel/${video.channelId}`;
  const engagementRate = video.viewCount && video.likeCount !== undefined && video.commentCount !== undefined
    ? ((video.likeCount + video.commentCount) / video.viewCount) * 100
    : null;
  const hasPerformanceScores = video.outlierScore !== undefined
    || video.velocityScore !== undefined
    || video.viewsPerDay !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl leading-tight pr-8" data-testid="text-dialog-title">
            {video.title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <a className="font-medium text-foreground hover:text-primary" href={channelUrl} target="_blank" rel="noopener noreferrer">
                    {video.channelTitle}
                  </a>
                  {video.channelStatistics?.subscriberCount !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      {t("video.subscribers", { count: formatViews(language, video.channelStatistics.subscriberCount) })}
                    </p>
                  )}
                </div>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-watch-youtube"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t("video.watchOnYouTube")}
                  </a>
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                  <Eye className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-lg font-semibold">{formatViews(language, video.viewCount)}</span>
                  <span className="text-xs text-muted-foreground">{t("video.views")}</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                  <ThumbsUp className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-lg font-semibold">{formatViews(language, video.likeCount)}</span>
                  <span className="text-xs text-muted-foreground">{t("video.likes")}</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                  <MessageSquare className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-lg font-semibold">{formatViews(language, video.commentCount)}</span>
                  <span className="text-xs text-muted-foreground">{t("video.comments")}</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                  <Clock className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-lg font-semibold">{formatDuration(t, video.duration)}</span>
                  <span className="text-xs text-muted-foreground">{t("video.duration")}</span>
                </div>
              </div>

              {hasPerformanceScores && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {video.outlierScore !== undefined && (
                      <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50" data-testid="stat-outlier-score">
                        <Sparkles className="h-5 w-5 text-muted-foreground mb-1" />
                        <span className="text-lg font-semibold">{formatRatio(language, video.outlierScore)}</span>
                        <span className="text-xs text-muted-foreground">{t("video.outlierScore")}</span>
                      </div>
                    )}
                    {video.velocityScore !== undefined && (
                      <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50" data-testid="stat-velocity-score">
                        <Zap className="h-5 w-5 text-muted-foreground mb-1" />
                        <span className="text-lg font-semibold">{formatRatio(language, video.velocityScore)}</span>
                        <span className="text-xs text-muted-foreground">{t("video.velocityScore")}</span>
                      </div>
                    )}
                    {video.viewsPerDay !== undefined && (
                      <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50" data-testid="stat-views-per-day">
                        <Activity className="h-5 w-5 text-muted-foreground mb-1" />
                        <span className="text-lg font-semibold">{Math.round(video.viewsPerDay).toLocaleString(intlLocale(language))}</span>
                        <span className="text-xs text-muted-foreground">{t("video.viewsPerDay")}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {video.outlierScore !== undefined && (
                      <>
                        {t("video.outlierExplanation")}
                        {video.channelMedianViews !== undefined
                          ? t("video.outlierMedian", {
                            median: formatViews(language, video.channelMedianViews),
                            sample: video.channelSampleSize !== undefined ? t("video.outlierSampleSuffix", { count: video.channelSampleSize }) : "",
                          })
                          : ""}
                        .{" "}
                      </>
                    )}
                    {video.velocityScore !== undefined && (
                      <>{t("video.velocityExplanation")}</>
                    )}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{t("video.publishedOn", { date: formatDate(language, video.publishedAt) })}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {engagementRate !== null && (
                  <Badge variant="outline">{t("video.engagement", { rate: engagementRate.toLocaleString(intlLocale(language), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</Badge>
                )}
                {video.definition && <Badge variant="secondary">{video.definition.toUpperCase()}</Badge>}
                {video.hasCaptions !== undefined && (
                  <Badge variant="secondary">{video.hasCaptions ? t("video.captions") : t("video.noCaptions")}</Badge>
                )}
                {(video.defaultAudioLanguage || video.defaultLanguage) && (
                  <Badge variant="secondary">{video.defaultAudioLanguage || video.defaultLanguage}</Badge>
                )}
                {video.hasPaidProductPlacement && (
                  <Badge variant="outline">{t("video.paidPromotion")}</Badge>
                )}
              </div>

              {video.description && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">{t("video.description")}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                    {video.description}
                  </p>
                </div>
              )}

              {video.tags && video.tags.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm">{t("video.tags")}</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {video.tags.slice(0, 10).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {video.tags.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        {t("video.moreTags", { count: video.tags.length - 10 })}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
