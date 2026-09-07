import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Eye,
  ExternalLink,
  Info,
  LayoutGrid,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Table2,
  ThumbsUp,
  Tv,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import type { ChannelAnalysisResponse, ChannelVideo } from "@shared/channel-contracts";

// ---------------------------------------------------------------------------
// Formatierung (bewusst aus video-card.tsx kopiert, damit die Dateien
// unabhängig bleiben)
// ---------------------------------------------------------------------------

const numberFormat = new Intl.NumberFormat("de-DE");
const oneDecimal = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "k. A.";
  if (value >= 1000000) return `${(value / 1000000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio.`;
  if (value >= 1000) return `${(value / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Tsd.`;
  return numberFormat.format(value);
}

function formatExact(value: number | null | undefined): string {
  if (value === null || value === undefined) return "k. A.";
  return numberFormat.format(Math.round(value));
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return `${oneDecimal.format(value)}x`;
}

function formatDateExact(dateString: string | null | undefined): string {
  if (!dateString) return "k. A.";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "k. A.";
  return dateFormat.format(date);
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.ceil(Math.abs(diffTime) / (1000 * 60 * 60 * 24));

  if (diffTime < 0) {
    if (diffDays <= 1) return "Geplant für morgen";
    return `Geplant in ${diffDays} Tagen`;
  }

  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Gestern";
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? "Woche" : "Wochen"}`;
  if (diffDays < 365) return `vor ${Math.floor(diffDays / 30)} ${Math.floor(diffDays / 30) === 1 ? "Monat" : "Monaten"}`;
  return `vor ${Math.floor(diffDays / 365)} ${Math.floor(diffDays / 365) === 1 ? "Jahr" : "Jahren"}`;
}

function formatDuration(duration: string | null | undefined): string {
  if (!duration) return "";
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;

  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatCountry(code: string | null): string | null {
  if (!code) return null;
  try {
    const names = new Intl.DisplayNames(["de"], { type: "region" });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

// ---------------------------------------------------------------------------
// Zuletzt analysierte Kanäle (localStorage)
// ---------------------------------------------------------------------------

const RECENT_STORAGE_KEY = "yp:channel-recent";
const RECENT_LIMIT = 8;

function loadRecentChannels(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string").slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function saveRecentChannels(entries: string[]) {
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(entries.slice(0, RECENT_LIMIT)));
  } catch {
    // localStorage nicht verfügbar: still ignorieren.
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

class ChannelRequestError extends Error {
  status: number;
  suggestion?: string;
  detail?: string;
  category?: string;
  retryable: boolean;

  constructor(options: {
    message: string;
    status: number;
    suggestion?: string;
    detail?: string;
    category?: string;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "ChannelRequestError";
    this.status = options.status;
    this.suggestion = options.suggestion;
    this.detail = options.detail;
    this.category = options.category;
    this.retryable = options.retryable ?? options.status >= 500;
  }
}

async function readApiError(response: Response): Promise<ChannelRequestError> {
  let payload: Record<string, unknown> = {};
  try {
    const text = await response.text();
    if (/^\s*(<!doctype html|<html|<head|<body)/i.test(text)) {
      payload = {
        error: `Der Server war nicht erreichbar (Status ${response.status}).`,
        suggestion: "Statt einer API-Antwort kam eine HTML-Fehlerseite. Versuche es erneut und prüfe, ob ein VPN, Firmennetz oder Filter aktiv ist.",
        retryable: true,
      };
    } else if (text) {
      payload = JSON.parse(text);
    }
  } catch {
    payload = {};
  }
  const message = typeof payload.error === "string" && payload.error
    ? payload.error
    : `Die Kanalanalyse ist fehlgeschlagen (Status ${response.status}).`;
  return new ChannelRequestError({
    message,
    status: response.status,
    suggestion: typeof payload.suggestion === "string" ? payload.suggestion : undefined,
    detail: typeof payload.detail === "string" ? payload.detail : undefined,
    category: typeof payload.category === "string" ? payload.category : undefined,
    retryable: typeof payload.retryable === "boolean" ? payload.retryable : undefined,
  });
}

type AnalysisRequest = {
  channel: string;
  maxVideos: number;
  refresh: boolean;
  nonce: number;
};

// ---------------------------------------------------------------------------
// Sortierung & Filter
// ---------------------------------------------------------------------------

type SortKey = "outlier" | "velocity" | "views" | "newest" | "oldest" | "likes" | "comments";
type LanguageFilter = "all" | "de" | "en" | "none";
type ViewMode = "grid" | "table";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "outlier", label: "Outlier-Wert" },
  { value: "velocity", label: "Tempo-Wert" },
  { value: "views", label: "Aufrufe" },
  { value: "newest", label: "Neueste zuerst" },
  { value: "oldest", label: "Älteste zuerst" },
  { value: "likes", label: "Likes" },
  { value: "comments", label: "Kommentare" },
];

const LANGUAGE_OPTIONS: { value: LanguageFilter; label: string }[] = [
  { value: "all", label: "Alle Sprachen" },
  { value: "de", label: "Deutsch" },
  { value: "en", label: "Englisch" },
  { value: "none", label: "Ohne Angabe" },
];

function videoLanguage(video: ChannelVideo): string {
  return (video.defaultAudioLanguage || video.defaultLanguage || "").toLowerCase();
}

function matchesLanguage(video: ChannelVideo, filter: LanguageFilter): boolean {
  if (filter === "all") return true;
  const lang = videoLanguage(video);
  if (filter === "none") return lang === "";
  return lang.startsWith(filter);
}

function numericOrMin(value: number | null): number {
  return value === null ? Number.NEGATIVE_INFINITY : value;
}

function sortVideos(videos: ChannelVideo[], sortKey: SortKey): ChannelVideo[] {
  const copy = [...videos];
  const byDate = (a: ChannelVideo, b: ChannelVideo) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
  switch (sortKey) {
    case "outlier":
      return copy.sort((a, b) => numericOrMin(b.outlierScore) - numericOrMin(a.outlierScore));
    case "velocity":
      return copy.sort((a, b) => numericOrMin(b.velocityScore) - numericOrMin(a.velocityScore));
    case "views":
      return copy.sort((a, b) => numericOrMin(b.viewCount) - numericOrMin(a.viewCount));
    case "likes":
      return copy.sort((a, b) => numericOrMin(b.likeCount) - numericOrMin(a.likeCount));
    case "comments":
      return copy.sort((a, b) => numericOrMin(b.commentCount) - numericOrMin(a.commentCount));
    case "newest":
      return copy.sort((a, b) => byDate(b, a));
    case "oldest":
      return copy.sort(byDate);
    default:
      return copy;
  }
}

function outlierBadgeClass(score: number | null): string {
  if (score === null) return "bg-black/70 text-white";
  if (score >= 5) return "bg-primary text-primary-foreground";
  if (score >= 2) return "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]";
  if (score < 1) return "bg-black/70 text-white/80";
  return "bg-background/90 text-foreground";
}

// ---------------------------------------------------------------------------
// Teilkomponenten
// ---------------------------------------------------------------------------

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="border-card-border bg-card">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-card-foreground">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ChannelVideoCard({ video }: { video: ChannelVideo }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${video.title} auf YouTube öffnen`}
      data-testid={`card-channel-video-${video.id}`}
    >
      <Card className="h-full overflow-hidden border-card-border bg-card transition-colors duration-300 hover:border-primary/50">
        <div className="relative aspect-video overflow-hidden bg-muted">
          {video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Tv className="h-8 w-8" aria-hidden="true" />
            </div>
          )}
          <div className="absolute left-2 top-2 flex items-center gap-1.5">
            <Badge className={`border-0 text-xs font-semibold tabular-nums shadow ${outlierBadgeClass(video.outlierScore)}`} title="Outlier-Wert">
              {formatScore(video.outlierScore)}
            </Badge>
            {video.velocityScore !== null && (
              <Badge variant="secondary" className="border-0 bg-black/70 text-[11px] tabular-nums text-white shadow" title="Tempo-Wert (Aufrufe pro Tag im Verhältnis zum Median)">
                Tempo {formatScore(video.velocityScore)}
              </Badge>
            )}
          </div>
          {video.duration && (
            <Badge variant="secondary" className="absolute bottom-2 right-2 bg-black/80 font-mono text-xs text-white">
              {formatDuration(video.duration)}
            </Badge>
          )}
        </div>
        <div className="space-y-3 p-4">
          <h3 className="line-clamp-2 text-base font-semibold leading-tight text-card-foreground transition-colors group-hover:text-primary">
            {video.title}
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {formatCount(video.viewCount)} Aufrufe
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {formatRelativeDate(video.publishedAt)}
            </span>
            {video.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDuration(video.duration)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 border-t border-border pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
              {formatCount(video.likeCount)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              {formatCount(video.commentCount)}
            </span>
          </div>
        </div>
      </Card>
    </a>
  );
}

function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <Card key={index} className="overflow-hidden border-card-border bg-card">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Kanal wird analysiert …</span>
      <Card className="border-card-border bg-card">
        <CardContent className="flex items-center gap-4 p-5">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-64" />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="border-card-border bg-card">
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="h-7 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <VideoGridSkeleton />
    </div>
  );
}

type SortableColumn = {
  key: SortKey | "date";
  label: string;
  align?: "right";
};

const TABLE_COLUMNS: SortableColumn[] = [
  { key: "date", label: "Veröffentlicht" },
  { key: "views", label: "Aufrufe", align: "right" },
  { key: "velocity", label: "Aufrufe/Tag", align: "right" },
  { key: "outlier", label: "Outlier", align: "right" },
  { key: "velocity", label: "Tempo", align: "right" },
  { key: "likes", label: "Likes", align: "right" },
  { key: "comments", label: "Kommentare", align: "right" },
];

// ---------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------

export default function ChannelPage() {
  const [inputValue, setInputValue] = useState("");
  const [maxVideos, setMaxVideos] = useState<number>(100);
  const [request, setRequest] = useState<AnalysisRequest | null>(null);
  const [recentChannels, setRecentChannels] = useState<string[]>([]);

  const [sortKey, setSortKey] = useState<SortKey>("outlier");
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [titleFilter, setTitleFilter] = useState("");

  useEffect(() => {
    setRecentChannels(loadRecentChannels());
  }, []);

  const rememberChannel = useCallback((channel: string) => {
    setRecentChannels((previous) => {
      const next = [channel, ...previous.filter((entry) => entry.toLowerCase() !== channel.toLowerCase())].slice(0, RECENT_LIMIT);
      saveRecentChannels(next);
      return next;
    });
  }, []);

  const startAnalysis = useCallback((rawChannel: string, refresh = false) => {
    const channel = rawChannel.trim();
    if (channel.length < 2) return;
    setInputValue(channel);
    setTitleFilter("");
    rememberChannel(channel);
    setRequest((previous) => ({
      channel,
      maxVideos,
      refresh,
      nonce: refresh ? (previous?.nonce ?? 0) + 1 : 0,
    }));
  }, [maxVideos, rememberChannel]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<ChannelAnalysisResponse, Error>({
    queryKey: ["/api/channel/analyze", request?.channel ?? "", request?.maxVideos ?? 0, request?.nonce ?? 0],
    queryFn: async ({ signal }) => {
      if (!request) throw new Error("Keine Anfrage.");
      const params = new URLSearchParams({
        channel: request.channel,
        maxVideos: String(request.maxVideos),
      });
      if (request.refresh) params.set("refresh", "true");
      let response: Response;
      try {
        response = await fetch(`/api/channel/analyze?${params.toString()}`, { signal, credentials: "include" });
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") throw requestError;
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        throw new ChannelRequestError({
          message: offline ? "Du scheinst offline zu sein." : "Der Server konnte nicht erreicht werden.",
          status: 0,
          suggestion: offline ? "Prüfe deine Internetverbindung und versuche es erneut." : "Versuche es in ein paar Sekunden erneut.",
          retryable: true,
        });
      }
      if (!response.ok) throw await readApiError(response);
      return response.json() as Promise<ChannelAnalysisResponse>;
    },
    enabled: request !== null,
    retry: false,
  });

  const requestError = isError ? (error instanceof ChannelRequestError ? error : null) : null;
  const showLoading = request !== null && (isLoading || isFetching);

  const filteredVideos = useMemo(() => {
    if (!data) return [];
    const needle = titleFilter.trim().toLowerCase();
    const filtered = data.videos.filter((video) =>
      matchesLanguage(video, languageFilter) && (needle === "" || video.title.toLowerCase().includes(needle)),
    );
    return sortVideos(filtered, sortKey);
  }, [data, languageFilter, titleFilter, sortKey]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      startAnalysis(inputValue);
    }
  };

  const handleHeaderSort = (key: SortableColumn["key"]) => {
    if (key === "date") {
      setSortKey((current) => (current === "newest" ? "oldest" : "newest"));
      return;
    }
    setSortKey(key);
  };

  const headerSortIcon = (key: SortableColumn["key"]) => {
    if (key === "date") {
      if (sortKey === "newest") return <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />;
      if (sortKey === "oldest") return <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />;
    } else if (sortKey === key) {
      return <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />;
    }
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />;
  };

  const channel = data?.channel;
  const stats = data?.stats;
  const country = channel ? formatCountry(channel.country) : null;

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-6 p-4 lg:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-channel-title">Kanalanalyse</h1>
        <p className="text-sm text-muted-foreground">
          Gib ein Kanal-Handle, eine Kanal-URL oder eine Kanal-ID ein und sieh alle Videos mit Outlier-Wert.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              aria-label="Kanal-Handle, Kanal-URL oder Kanal-ID"
              placeholder="@Finanz4U oder https://www.youtube.com/@Finanz4U"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              className="h-11 pl-10"
              data-testid="input-channel"
            />
          </div>
          <Select value={String(maxVideos)} onValueChange={(value) => setMaxVideos(Number(value))}>
            <SelectTrigger className="h-11 w-full sm:w-40" aria-label="Anzahl Videos" data-testid="select-channel-max-videos">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 Videos</SelectItem>
              <SelectItem value="100">100 Videos</SelectItem>
              <SelectItem value="200">200 Videos</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => startAnalysis(inputValue)}
            disabled={inputValue.trim().length < 2 || showLoading}
            className="h-11 px-6"
            data-testid="button-channel-analyze"
          >
            {showLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Analysieren
          </Button>
        </div>

        {recentChannels.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Zuletzt analysierte Kanäle">
            <span className="text-xs text-muted-foreground">Zuletzt:</span>
            {recentChannels.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => startAnalysis(entry)}
                disabled={showLoading}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-card-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                data-testid={`chip-recent-channel-${entry}`}
              >
                {entry}
              </button>
            ))}
          </div>
        )}
      </div>

      {request === null && (
        <EmptyState
          icon={Tv}
          title="Kanal analysieren"
          description="Gib oben einen Kanal ein. Du bekommst alle Videos mit Outlier- und Tempo-Wert, um die Ausreißer des Kanals auf einen Blick zu erkennen."
        />
      )}

      {showLoading && <LoadingState />}

      {requestError && !showLoading && (
        <Alert variant="destructive" data-testid="alert-channel-error">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>{requestError.message}</AlertTitle>
          <AlertDescription className="space-y-2">
            {requestError.suggestion && <p>{requestError.suggestion}</p>}
            {requestError.detail && <p className="text-xs opacity-80">{requestError.detail}</p>}
            <div className="pt-1">
              <Button variant="outline" size="sm" onClick={() => void refetch()} data-testid="button-channel-retry">
                <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                Erneut versuchen
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {data && channel && stats && !showLoading && (
        <div className="space-y-6">
          <Card className="border-card-border bg-card" data-testid="card-channel-header">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                {channel.thumbnailUrl ? (
                  <img src={channel.thumbnailUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Tv className="h-7 w-7" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-card-foreground">{channel.title}</h2>
                  {data.cached && (
                    <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                      aus Cache (max. 12 h alt)
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <a
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    data-testid="link-channel-url"
                  >
                    {channel.handle || channel.customUrl || "Kanal öffnen"}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                  {country && <span>{country}</span>}
                  {channel.publishedAt && <span>Kanal seit {formatDateExact(channel.publishedAt)}</span>}
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  <div className="flex items-baseline gap-2">
                    <dt className="text-muted-foreground">Abonnenten</dt>
                    <dd className="font-medium tabular-nums text-card-foreground">
                      {channel.hiddenSubscriberCount ? "verborgen" : formatCount(channel.subscriberCount)}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="text-muted-foreground">Videos gesamt</dt>
                    <dd className="font-medium tabular-nums text-card-foreground">{formatExact(channel.videoCount)}</dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="text-muted-foreground">Aufrufe gesamt</dt>
                    <dd className="font-medium tabular-nums text-card-foreground">{formatCount(channel.viewCount)}</dd>
                  </div>
                </dl>
              </div>
              <div className="shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startAnalysis(request?.channel ?? inputValue, true)}
                  disabled={showLoading}
                  data-testid="button-channel-refresh"
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                  Aktualisieren
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <StatTile label="Analysierte Videos" value={formatExact(stats.analyzedVideos)} />
            <StatTile label="Median Aufrufe" value={formatCount(stats.medianViews)} hint={stats.medianViews !== null ? formatExact(stats.medianViews) : undefined} />
            <StatTile label="Durchschnitt Aufrufe" value={formatCount(stats.meanViews)} hint={stats.meanViews !== null ? formatExact(stats.meanViews) : undefined} />
            <StatTile label="Median Aufrufe/Tag" value={formatCount(stats.medianViewsPerDay)} />
            <StatTile
              label="Zeitraum"
              value={stats.oldestAnalyzedAt && stats.newestAnalyzedAt ? `${formatDateExact(stats.oldestAnalyzedAt)} – ${formatDateExact(stats.newestAnalyzedAt)}` : "k. A."}
            />
          </div>

          {stats.lowConfidence && (
            <div className="flex items-start gap-2 rounded-md border border-warning-subtle bg-warning-subtle p-3 text-sm text-warning" role="status">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Weniger als 10 Videos analysiert. Outlier-Werte sind bei so kleinen Stichproben wenig aussagekräftig.</span>
            </div>
          )}

          {data.warnings.length > 0 && (
            <ul className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground" aria-label="Hinweise">
              {data.warnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-start gap-2 rounded-md border border-info-subtle bg-info-subtle p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
            <p>
              Outlier-Wert = Aufrufe des Videos geteilt durch den Median aller analysierten Videos dieses Kanals. 3,0x bedeutet: dreimal so viele Aufrufe wie ein typisches Video. Tempo-Wert = dasselbe für Aufrufe pro Tag, gleicht das Alter der Videos aus.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                <SelectTrigger className="w-full sm:w-44" aria-label="Sortierung" data-testid="select-channel-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={languageFilter} onValueChange={(value) => setLanguageFilter(value as LanguageFilter)}>
                <SelectTrigger className="w-full sm:w-40" aria-label="Sprachfilter" data-testid="select-channel-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="search"
                  aria-label="Nach Titel filtern"
                  placeholder="Nach Titel filtern …"
                  value={titleFilter}
                  onChange={(event) => setTitleFilter(event.target.value)}
                  className="pl-9"
                  data-testid="input-channel-title-filter"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground" data-testid="text-channel-video-count">
                {numberFormat.format(filteredVideos.length)} von {numberFormat.format(data.videos.length)} Videos
              </span>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => { if (value) setViewMode(value as ViewMode); }}
                aria-label="Ansicht"
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="grid" aria-label="Rasteransicht" data-testid="toggle-channel-view-grid">
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Tabellenansicht" data-testid="toggle-channel-view-table">
                  <Table2 className="h-4 w-4" aria-hidden="true" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {filteredVideos.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Keine Videos gefunden"
              description="Kein Video passt zu Filter oder Suchbegriff. Setze den Sprachfilter zurück oder ändere den Suchbegriff."
            />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="grid-channel-videos">
              {filteredVideos.map((video) => (
                <ChannelVideoCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden border-card-border bg-card" data-testid="table-channel-videos">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[104px]">Vorschau</TableHead>
                      <TableHead className="min-w-[240px]">Titel</TableHead>
                      {TABLE_COLUMNS.map((column) => (
                        <TableHead key={column.label} className={column.align === "right" ? "text-right" : undefined}>
                          <button
                            type="button"
                            onClick={() => handleHeaderSort(column.key)}
                            className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground ${column.align === "right" ? "flex-row-reverse" : ""}`}
                            aria-label={`Nach ${column.label} sortieren`}
                          >
                            {column.label}
                            {headerSortIcon(column.key)}
                          </button>
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Dauer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVideos.map((video) => (
                      <TableRow key={video.id}>
                        <TableCell className="py-2">
                          <div className="aspect-video w-20 overflow-hidden rounded bg-muted">
                            {video.thumbnailUrl && (
                              <img src={video.thumbnailUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" loading="lazy" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="line-clamp-2 font-medium text-card-foreground hover:text-primary hover:underline"
                          >
                            {video.title}
                          </a>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2 tabular-nums">{formatDateExact(video.publishedAt)}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{formatExact(video.viewCount)}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{formatExact(video.viewsPerDay)}</TableCell>
                        <TableCell className="py-2 text-right">
                          <Badge className={`border-0 tabular-nums ${outlierBadgeClass(video.outlierScore)}`}>
                            {formatScore(video.outlierScore)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{formatScore(video.velocityScore)}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{formatExact(video.likeCount)}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{formatExact(video.commentCount)}</TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs">{formatDuration(video.duration) || "–"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
