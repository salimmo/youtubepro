import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, Video as VideoIcon, Loader2, TrendingUp, Users, Eye, Clock,
  ChevronDown, ChevronUp, Target, Lightbulb, BarChart3,
  HelpCircle, Download, ArrowRight, ExternalLink, RefreshCw, Activity,
  Database, Hash, ListChecks, Sparkles, Compass, CheckCircle2, FlaskConical,
  AlertCircle, KeyRound, WifiOff, Image as ImageIcon, PlayCircle, FileSpreadsheet, Table2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { generateResearchPDF } from "@/lib/pdfGenerator";
import {
  downloadResearchCsv,
  downloadResearchXls,
  type ResearchReportData,
} from "@/lib/research-export";
import { useWorkflow } from "@/lib/workflow-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VideoCard } from "@/components/video-card";
import { VideoCardSkeleton } from "@/components/video-card-skeleton";
import { EmptyState } from "@/components/empty-state";
import { SearchFilters } from "@/components/search-filters";
import { VideoDetailDialog } from "@/components/video-detail-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { StarryBackground } from "@/components/ui/starry-background";
import type { IdeaGenerationResponse, IdeaPackage, Video, SearchResponse, ResearchInsightsResponse } from "@shared/schema";
import { UploadDateFilter, DurationFilter, SortBy, LanguageFilter } from "@shared/schema";
import { calculateYouTubeAnalytics } from "@/lib/youtube-analytics";
import {
  DIFFICULTY_LABELS,
  IDEA_FORMAT_LABELS,
  EVIDENCE_CLASS_LABELS,
  CONFIDENCE_LABELS,
  DISCOVERY_SURFACE_LABELS,
  labelFor,
} from "@/lib/labels";
import { useI18n, translate, getActiveLanguage, formatCompact } from "@/lib/i18n";

function enrichmentKeyLabel(name: string): string {
  const key = `research.enrichmentKey.${name}`;
  const label = translate(getActiveLanguage(), key);
  return label === key ? name : label;
}

type ResearchInsights = ResearchInsightsResponse;

type GroundedIdeaResponse = IdeaGenerationResponse;

type AppliedFilters = {
  uploadDate: UploadDateFilter;
  duration: DurationFilter;
  sortBy: SortBy;
  language: LanguageFilter;
};

type ApiWarning = SearchResponse["warnings"][number];
type ResearchSearchResponse = SearchResponse;

type ApiErrorCategory =
  | "missing_key"
  | "invalid_key"
  | "quota"
  | "timeout"
  | "offline"
  | "server"
  | "invalid_response"
  | "unknown";

class ResearchRequestError extends Error {
  status: number;
  code?: string;
  category: ApiErrorCategory;
  retryable: boolean;
  suggestion?: string;
  detail?: string;

  constructor(options: {
    message: string;
    status: number;
    code?: string;
    category: ApiErrorCategory;
    retryable?: boolean;
    suggestion?: string;
    detail?: string;
  }) {
    super(options.message);
    this.name = "ResearchRequestError";
    this.status = options.status;
    this.code = options.code;
    this.category = options.category;
    this.retryable = options.retryable ?? options.status >= 500;
    this.suggestion = options.suggestion;
    this.detail = options.detail;
  }
}

// Zeigt neben dem Hinweis die bereinigte Originalmeldung des Anbieters, damit
// die Ursache ohne Blick ins Server-Log erkennbar ist.
function withDetail(error: ResearchRequestError): string {
  const base = error.suggestion || error.message;
  return error.detail ? `${base} ${translate(getActiveLanguage(), "common.providerMessage")}: ${error.detail}` : base;
}

function normalizeErrorCategory(status: number, category: unknown, message: string): ApiErrorCategory {
  const normalized = `${String(category || "")} ${message}`.toLowerCase();
  if (normalized.includes("missing") && normalized.includes("key")) return "missing_key";
  if (normalized.includes("invalid") && (normalized.includes("key") || normalized.includes("credential"))) return "invalid_key";
  if (status === 429 || normalized.includes("quota") || normalized.includes("rate limit")) return "quota";
  if (normalized.includes("timeout") || normalized.includes("timed out")) return "timeout";
  if (normalized.includes("network")) return "offline";
  if (normalized.includes("invalid_response") || normalized.includes("invalid response") || normalized.includes("schema")) return "invalid_response";
  if (normalized.includes("provider_server")) return "server";
  if (status >= 500) return "server";
  if (status === 401 || status === 403) return "invalid_key";
  return "unknown";
}

async function readApiError(response: Response): Promise<ResearchRequestError> {
  let payload: Record<string, unknown> = {};
  try {
    const text = await response.text();
    if (/^\s*(<!doctype html|<html|<head|<body)/i.test(text)) {
      const title = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(text)?.[1]?.trim();
      payload = {
        error: translate(getActiveLanguage(), "research.error.htmlServerUnreachable", { status: response.status }),
        suggestion: translate(getActiveLanguage(), "research.error.htmlSuggestion"),
        detail: title ? translate(getActiveLanguage(), "research.error.htmlPageTitle", { title }) : translate(getActiveLanguage(), "research.error.htmlNoTitle"),
        category: "provider_server",
        retryable: true,
      };
    } else {
      payload = JSON.parse(text);
    }
  } catch {
    payload = {};
  }
  const message = typeof payload.error === "string" ? payload.error : response.statusText || translate(getActiveLanguage(), "research.error.requestFailed");
  return new ResearchRequestError({
    message,
    status: response.status,
    code: typeof payload.code === "string" ? payload.code : undefined,
    category: normalizeErrorCategory(response.status, payload.category, message),
    retryable: typeof payload.retryable === "boolean" ? payload.retryable : response.status >= 500,
    suggestion: typeof payload.suggestion === "string" ? payload.suggestion : undefined,
    detail: typeof payload.detail === "string" ? payload.detail : undefined,
  });
}

function warningText(warning: ApiWarning): string {
  return warning.message || warning.code || translate(getActiveLanguage(), "research.warning.enrichmentUnavailable");
}

function scanLabel(value: string, fallback: string): string {
  const cleaned = value.replace(/^gap\s*\d*\s*[-:]\s*/i, "").trim();
  if (!cleaned) return fallback;
  const firstClause = cleaned.split(/[.:;]/)[0]?.trim() || cleaned;
  return firstClause.length > 76 ? `${firstClause.slice(0, 75).trimEnd()}…` : firstClause;
}

function errorPresentation(category: ApiErrorCategory) {
  const language = getActiveLanguage();
  switch (category) {
    case "missing_key":
      return { title: translate(language, "research.errorTitle.missingKey"), icon: KeyRound };
    case "invalid_key":
      return { title: translate(language, "research.errorTitle.invalidKey"), icon: KeyRound };
    case "quota":
      return { title: translate(language, "research.errorTitle.quota"), icon: AlertCircle };
    case "timeout":
      return { title: translate(language, "research.errorTitle.timeout"), icon: WifiOff };
    case "offline":
      return { title: translate(language, "research.errorTitle.offline"), icon: WifiOff };
    case "server":
      return { title: translate(language, "research.errorTitle.server"), icon: AlertCircle };
    default:
      return { title: translate(language, "research.errorTitle.unknown"), icon: AlertCircle };
  }
}

function aiErrorTitle(category: ApiErrorCategory | null): string {
  const language = getActiveLanguage();
  switch (category) {
    case "missing_key": return translate(language, "research.aiErrorTitle.missingKey");
    case "invalid_key": return translate(language, "research.aiErrorTitle.invalidKey");
    case "quota": return translate(language, "research.aiErrorTitle.quota");
    case "timeout": return translate(language, "research.aiErrorTitle.timeout");
    case "offline": return translate(language, "research.aiErrorTitle.offline");
    case "server": return translate(language, "research.aiErrorTitle.server");
    default: return translate(language, "research.aiErrorTitle.unknown");
  }
}

const CHART_COLORS = ["#f28b82", "#7aa2d6", "#73b3a6", "#a78bca", "#d4a85a"];
const BAR_COLORS = ["#ef9a90", "#86a9d5", "#7fb7aa", "#a995c9", "#d2af6d", "#8fa5b8"];

function formatNumber(num: number): string {
  return formatCompact(getActiveLanguage(), num);
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
      </div>
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-6 ai-insights-glow rounded-lg p-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function IdeasSkeleton() {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={t("research.ideasGeneratingAria")}>
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ResearchDashboard() {
  const [, setLocation] = useLocation();
  const { t, locale } = useI18n();
  const { state: workflowState, setCachedResearch, setIdeaData, clearHighlight, goToStep } = useWorkflow();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [uploadDate, setUploadDate] = useState<UploadDateFilter>(UploadDateFilter.ANY);
  const [duration, setDuration] = useState<DurationFilter>(DurationFilter.ANY);
  const [sortBy, setSortBy] = useState<SortBy>(SortBy.RELEVANCE);
  const [language, setLanguage] = useState<LanguageFilter>(LanguageFilter.ANY);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    uploadDate: UploadDateFilter.ANY,
    duration: DurationFilter.ANY,
    sortBy: SortBy.RELEVANCE,
    language: LanguageFilter.ANY,
  });
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [evidenceLedgerOpen, setEvidenceLedgerOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xls" | "csv" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const isProgrammaticFocus = useRef(false);

  const [insights, setInsights] = useState<ResearchInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsErrorCategory, setInsightsErrorCategory] = useState<ApiErrorCategory | null>(null);
  const [ideaPackages, setIdeaPackages] = useState<IdeaPackage[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<IdeaPackage | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [ideasErrorCategory, setIdeasErrorCategory] = useState<ApiErrorCategory | null>(null);
  const insightsFetchedRef = useRef<string>("");
  const ideasFetchedRef = useRef<string>("");
  const [cachedData, setCachedData] = useState<ResearchSearchResponse | null>(null);
  const restoredFromCache = useRef(false);
  const insightAbortRef = useRef<AbortController | null>(null);
  const ideaAbortRef = useRef<AbortController | null>(null);
  const currentSnapshotRef = useRef<string>("");
  const workflowStartTriggerRef = useRef(workflowState.highlightTrigger);

  useEffect(() => {
    if (!restoredFromCache.current && workflowState.cachedResearch && !submittedQuery) {
      restoredFromCache.current = true;
      const cached = workflowState.cachedResearch;
      setSearchQuery(cached.query);
      setSubmittedQuery(cached.query);
      setUploadDate(cached.filters.uploadDate as UploadDateFilter);
      setDuration(cached.filters.duration as DurationFilter);
      setSortBy(cached.filters.sortBy as SortBy);
      const cachedLanguage = (cached.filters.language as LanguageFilter | undefined) || LanguageFilter.ANY;
      setLanguage(cachedLanguage);
      setAppliedFilters({
        uploadDate: cached.filters.uploadDate as UploadDateFilter,
        duration: cached.filters.duration as DurationFilter,
        sortBy: cached.filters.sortBy as SortBy,
        language: cachedLanguage,
      });
      if (cached.insights) {
        setInsights(cached.insights as ResearchInsights);
        insightsFetchedRef.current = cached.snapshotId || `legacy-${cached.timestamp}`;
      }
      setCachedData({
        videos: cached.videos,
        totalResults: cached.totalResults,
        resultsPerPage: cached.resultsPerPage,
        regionCode: cached.regionCode,
        nextPageToken: cached.nextPageToken,
        snapshotId: cached.snapshotId || `legacy-${cached.timestamp}`,
        retrievedAt: cached.retrievedAt || new Date(cached.timestamp).toISOString(),
        totalResultsIsApproximate: cached.totalResultsIsApproximate ?? true,
        warnings: cached.warnings || [],
        enrichment: cached.enrichment || {
          search: { status: "complete", requested: cached.videos.length, returned: cached.videos.length },
          videoDetails: { status: "complete", requested: cached.videos.length, returned: cached.videos.length },
          channels: { status: "skipped", requested: 0, returned: 0 },
        },
        provenance: cached.provenance || {
          provider: "youtube-data-api-v3",
          query: cached.query,
          filters: {
            uploadDate: cached.filters.uploadDate as UploadDateFilter,
            duration: cached.filters.duration as DurationFilter,
            sortBy: cached.filters.sortBy as SortBy,
            language: cachedLanguage,
            maxResults: 50,
          },
          orderedVideoIds: cached.videos.map((video) => video.id),
        },
      });
      const restoredSnapshotId = cached.snapshotId || `legacy-${cached.timestamp}`;
      currentSnapshotRef.current = restoredSnapshotId;
      if (
        workflowState.idea?.niche === cached.query
        || workflowState.idea?.evidenceContext?.snapshotId === restoredSnapshotId
      ) {
        const restoredIdeas = workflowState.idea.generatedIdeas || [];
        setIdeaPackages(restoredIdeas);
        setSelectedIdea(workflowState.idea.selectedIdea);
        if (restoredIdeas.length > 0) ideasFetchedRef.current = restoredSnapshotId;
      }
    }
  }, [workflowState.cachedResearch, submittedQuery]);

  useEffect(() => {
    if (workflowState.highlightSearchBox && searchInputRef.current) {
      setAnimationKey(prev => prev + 1);
      isProgrammaticFocus.current = true;
      searchInputRef.current.focus();
      searchInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });

      const timer = setTimeout(() => {
        clearHighlight();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [workflowState.highlightSearchBox, workflowState.highlightTrigger, clearHighlight]);

  useEffect(() => {
    if (workflowStartTriggerRef.current === workflowState.highlightTrigger) return;
    workflowStartTriggerRef.current = workflowState.highlightTrigger;
    if (!workflowState.isWorkflowActive || workflowState.cachedResearch) return;

    insightAbortRef.current?.abort();
    ideaAbortRef.current?.abort();
    setSearchQuery("");
    setSubmittedQuery("");
    setUploadDate(UploadDateFilter.ANY);
    setDuration(DurationFilter.ANY);
    setSortBy(SortBy.RELEVANCE);
    setLanguage(LanguageFilter.ANY);
    setAppliedFilters({
      uploadDate: UploadDateFilter.ANY,
      duration: DurationFilter.ANY,
      sortBy: SortBy.RELEVANCE,
      language: LanguageFilter.ANY,
    });
    setCachedData(null);
    setInsights(null);
    setInsightsError(null);
    setInsightsErrorCategory(null);
    setIdeaPackages([]);
    setSelectedIdea(null);
    setIdeasLoading(false);
    setIdeasError(null);
    setIdeasErrorCategory(null);
    setExportError(null);
    setExpandedQuestions(new Set());
    setEvidenceLedgerOpen(false);
    setMethodologyOpen(false);
    currentSnapshotRef.current = "";
    insightsFetchedRef.current = "";
    ideasFetchedRef.current = "";
    restoredFromCache.current = false;
  }, [workflowState.highlightTrigger, workflowState.isWorkflowActive, workflowState.cachedResearch]);

  const handleSearchFocus = () => {
    if (isProgrammaticFocus.current) {
      isProgrammaticFocus.current = false;
      return;
    }
    if (workflowState.highlightSearchBox) {
      clearHighlight();
    }
  };

  const buildSearchUrl = () => {
    const params = new URLSearchParams({
      query: submittedQuery,
      uploadDate: appliedFilters.uploadDate,
      duration: appliedFilters.duration,
      sortBy: appliedFilters.sortBy,
      language: appliedFilters.language,
      maxResults: "50",
    });
    return `/api/youtube/search?${params}`;
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<ResearchSearchResponse>({
    queryKey: [
      "/api/youtube/search",
      submittedQuery,
      appliedFilters.uploadDate,
      appliedFilters.duration,
      appliedFilters.sortBy,
      appliedFilters.language,
    ],
    queryFn: async ({ signal }) => {
      let res: Response;
      try {
        res = await fetch(buildSearchUrl(), { signal, credentials: "include" });
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") throw requestError;
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        throw new ResearchRequestError({
          message: offline ? t("research.error.offline") : t("research.error.searchUnreachable"),
          status: 0,
          category: offline ? "offline" : "server",
          retryable: true,
        });
      }
      if (!res.ok) {
        throw await readApiError(res);
      }
      return res.json();
    },
    enabled: submittedQuery.length > 0 && !cachedData,
  });

  const sourceData = data || cachedData;
  const snapshotId = sourceData?.snapshotId || [
    submittedQuery,
    appliedFilters.uploadDate,
    appliedFilters.duration,
    appliedFilters.sortBy,
    appliedFilters.language,
    sourceData?.retrievedAt || "cached",
    sourceData?.videos?.map((video) => video.id).join(",") || "",
  ].join("|");
  const insightRequestKey = snapshotId;

  useEffect(() => {
    if (!sourceData?.videos?.length || !snapshotId) return;
    if (currentSnapshotRef.current === snapshotId) return;
    insightAbortRef.current?.abort();
    ideaAbortRef.current?.abort();
    currentSnapshotRef.current = snapshotId;
    setInsights(null);
    setInsightsError(null);
    setInsightsErrorCategory(null);
    setInsightsLoading(false);
    insightsFetchedRef.current = "";
    setIdeaPackages([]);
    setSelectedIdea(null);
    setIdeasLoading(false);
    setIdeasError(null);
    setIdeasErrorCategory(null);
    ideasFetchedRef.current = "";
  }, [snapshotId, sourceData]);

  useEffect(() => () => {
    insightAbortRef.current?.abort();
    ideaAbortRef.current?.abort();
  }, []);

  const fetchInsights = useCallback(async () => {
    if (!sourceData?.videos || sourceData.videos.length === 0 || insightsLoading || isFetching) return;
    if (insightsFetchedRef.current === insightRequestKey) return;

    const snapshotAnalytics = calculateYouTubeAnalytics(sourceData.videos);

    insightAbortRef.current?.abort();
    const controller = new AbortController();
    insightAbortRef.current = controller;
    const requestedSnapshotId = insightRequestKey;
    setInsightsLoading(true);
    setInsightsError(null);
    setInsightsErrorCategory(null);
    insightsFetchedRef.current = insightRequestKey;
    try {
      const response = await fetch("/api/research/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          query: submittedQuery,
          videos: sourceData.videos,
          snapshotId: requestedSnapshotId,
          retrievedAt: sourceData.retrievedAt,
          provenance: sourceData.provenance,
          analytics: {
            totalVideos: snapshotAnalytics.totalVideos,
            totalViews: snapshotAnalytics.totalViews,
            avgViews: snapshotAnalytics.avgViews,
            medianViews: snapshotAnalytics.medianViews,
            medianDailyViews: snapshotAnalytics.medianDailyViews,
            avgEngagement: snapshotAnalytics.avgEngagement === "N/A"
              ? "N/A"
              : Number(snapshotAnalytics.avgEngagement),
            uniqueChannels: snapshotAnalytics.uniqueChannels,
            durationData: snapshotAnalytics.durationData,
            recencyData: snapshotAnalytics.recencyData,
            topTags: snapshotAnalytics.topTags,
            coverage: snapshotAnalytics.coverage,
          },
          enrichment: sourceData.enrichment,
          warnings: sourceData.warnings,
        }),
      });
      if (!response.ok) throw await readApiError(response);
      const result = await response.json() as ResearchInsights & { snapshotId?: string };
      if (
        controller.signal.aborted ||
        currentSnapshotRef.current !== requestedSnapshotId ||
        result.snapshotId !== requestedSnapshotId
      ) {
        return;
      }
      setInsights(result);
    } catch (requestError) {
      if (controller.signal.aborted) return;
      const normalizedError = requestError instanceof ResearchRequestError
        ? requestError
        : new ResearchRequestError({
            message: requestError instanceof Error ? requestError.message : t("research.error.insightsFailed"),
            status: 0,
            category: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "unknown",
            retryable: true,
          });
      setInsightsError(withDetail(normalizedError));
      setInsightsErrorCategory(normalizedError.category);
      insightsFetchedRef.current = "";
    } finally {
      if (currentSnapshotRef.current === requestedSnapshotId) setInsightsLoading(false);
    }
  }, [sourceData, submittedQuery, insightsLoading, isFetching, insightRequestKey]);

  useEffect(() => {
    if (sourceData?.videos && sourceData.videos.length > 0 && !isFetching && !insights && !insightsLoading && !insightsError) {
      void fetchInsights();
    }
  }, [sourceData, isFetching, insights, insightsLoading, insightsError, fetchInsights]);

  const fetchIdeas = useCallback(async () => {
    if (!sourceData?.videos.length || !insights || ideasLoading || isFetching) return;
    if (ideasFetchedRef.current === snapshotId) return;

    const evidenceClaims = insights.evidenceClaims || [];
    if (evidenceClaims.length === 0) {
      ideasFetchedRef.current = snapshotId;
      setIdeasError(t("research.error.legacySnapshot"));
      setIdeasErrorCategory("unknown");
      return;
    }

    ideaAbortRef.current?.abort();
    const controller = new AbortController();
    ideaAbortRef.current = controller;
    const requestedSnapshotId = snapshotId;
    setIdeasLoading(true);
    setIdeasError(null);
    setIdeasErrorCategory(null);
    ideasFetchedRef.current = requestedSnapshotId;

    try {
      const response = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          niche: submittedQuery,
          keywords: insights.trendingSubtopics?.slice(0, 6).join(", ") || "",
          audience: insights.targetAudience?.primaryDemographic || "",
          researchContext: {
            query: submittedQuery,
            snapshotId: requestedSnapshotId,
            sourceVideoIds: sourceData.provenance.orderedVideoIds,
            evidenceClaims,
          },
        }),
      });
      if (!response.ok) throw await readApiError(response);
      const result = await response.json() as GroundedIdeaResponse;
      if (
        controller.signal.aborted
        || currentSnapshotRef.current !== requestedSnapshotId
        || result.snapshotId !== requestedSnapshotId
      ) {
        return;
      }
      setIdeaPackages(result.ideas);
      setSelectedIdea(null);
      setIdeaData({
        selectedIdea: null,
        generatedIdeas: result.ideas,
        niche: submittedQuery,
        audience: insights.targetAudience?.primaryDemographic || "",
      });
    } catch (requestError) {
      if (controller.signal.aborted) return;
      const normalizedError = requestError instanceof ResearchRequestError
        ? requestError
        : new ResearchRequestError({
            message: requestError instanceof Error ? requestError.message : t("research.error.ideasFailed"),
            status: 0,
            category: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "unknown",
            retryable: true,
          });
      setIdeasError(withDetail(normalizedError));
      setIdeasErrorCategory(normalizedError.category);
      ideasFetchedRef.current = "";
    } finally {
      if (currentSnapshotRef.current === requestedSnapshotId) setIdeasLoading(false);
    }
  }, [sourceData, insights, ideasLoading, isFetching, snapshotId, submittedQuery, setIdeaData]);

  useEffect(() => {
    if (insights && !insightsLoading && !ideasLoading && ideaPackages.length === 0 && !ideasError) {
      void fetchIdeas();
    }
  }, [insights, insightsLoading, ideasLoading, ideaPackages.length, ideasError, fetchIdeas]);

  const handleSearch = useCallback(async () => {
    if (searchQuery.trim()) {
      const nextQuery = searchQuery.trim();
      const sameSearch = nextQuery === submittedQuery
        && uploadDate === appliedFilters.uploadDate
        && duration === appliedFilters.duration
        && sortBy === appliedFilters.sortBy
        && language === appliedFilters.language;
      insightAbortRef.current?.abort();
      ideaAbortRef.current?.abort();
      setCachedData(null);
      setInsights(null);
      setInsightsError(null);
      setInsightsErrorCategory(null);
      setIdeaPackages([]);
      setSelectedIdea(null);
      setIdeasLoading(false);
      setIdeasError(null);
      setIdeasErrorCategory(null);
      setExportError(null);
      insightsFetchedRef.current = "";
      ideasFetchedRef.current = "";
      setAppliedFilters({ uploadDate, duration, sortBy, language });
      setSubmittedQuery(nextQuery);
      if (sameSearch) await refetch();
    }
  }, [searchQuery, submittedQuery, uploadDate, duration, sortBy, language, appliedFilters, refetch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video);
    setDialogOpen(true);
  };

  const toggleQuestion = (index: number) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const buildCurrentReport = (): ResearchReportData | null => {
    const sourceData = data || cachedData;
    if (!sourceData?.videos || !analytics || !insights || ideaPackages.length === 0) return null;
    return {
      query: submittedQuery,
      totalResults: sourceData.totalResults,
      totalResultsIsApproximate: sourceData.totalResultsIsApproximate,
      resultsPerPage: sourceData.resultsPerPage,
      regionCode: sourceData.regionCode,
      nextPageToken: sourceData.nextPageToken,
      snapshotId: sourceData.snapshotId,
      retrievedAt: sourceData.retrievedAt,
      filters: {
        uploadDate: appliedFilters.uploadDate,
        duration: appliedFilters.duration,
        sortBy: appliedFilters.sortBy,
        language: appliedFilters.language,
      },
      analytics,
      videos: sourceData.videos,
      insights,
      ideas: ideaPackages,
      provenance: sourceData.provenance,
      enrichment: sourceData.enrichment,
      warnings: sourceData.warnings,
    };
  };

  const handleExport = async (format: "pdf" | "xls" | "csv") => {
    if (exporting) return;
    const report = buildCurrentReport();
    if (!report) {
      setExportError(t("research.error.exportNotReady"));
      return;
    }

    setExporting(format);
    setExportError(null);
    try {
      // Yield once so the selected button can paint its format-specific state
      // before synchronous spreadsheet serialization begins.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (format === "pdf") await generateResearchPDF(report);
      else if (format === "xls") downloadResearchXls(report);
      else downloadResearchCsv(report);
    } catch (error) {
      console.error(`Failed to generate ${format.toUpperCase()} export:`, error);
      setExportError(t("research.error.exportFailed", { format: format.toUpperCase() }));
    } finally {
      setExporting(null);
    }
  };

  const analytics = useMemo(() => {
    const sourceVideos = (data || cachedData)?.videos;
    return sourceVideos && sourceVideos.length > 0
      ? calculateYouTubeAnalytics(sourceVideos)
      : null;
  }, [data, cachedData]);

  // Top 5 nach Outlier-Wert; nur Videos, für die der Server eine Kanal-Baseline hatte.
  const outlierLeaders = useMemo(() => {
    const sourceVideos = (data || cachedData)?.videos || [];
    return sourceVideos
      .filter((video): video is Video & { outlierScore: number } => typeof video.outlierScore === "number")
      .sort((a, b) => b.outlierScore - a.outlierScore)
      .slice(0, 5);
  }, [data, cachedData]);

  const saveResearchToCache = useCallback(() => {
    const sourceData = data || cachedData;
    if (!sourceData?.videos || !analytics) return;

    setCachedResearch({
      query: submittedQuery,
      totalResults: sourceData.totalResults,
      resultsPerPage: sourceData.resultsPerPage,
      regionCode: sourceData.regionCode,
      nextPageToken: sourceData.nextPageToken,
      videos: sourceData.videos,
      insights: insights,
      analytics: {
        totalViews: analytics.totalViews,
        avgViews: analytics.avgViews,
        avgEngagement: analytics.avgEngagement,
        totalVideos: analytics.totalVideos,
        totalEngagement: analytics.totalEngagement,
        viewsDistribution: analytics.viewsDistribution,
        durationData: analytics.durationData,
        topVideo: analytics.topVideo,
        topVideosList: analytics.topVideosList,
      },
      filters: {
        uploadDate: appliedFilters.uploadDate,
        duration: appliedFilters.duration,
        sortBy: appliedFilters.sortBy,
        language: appliedFilters.language,
      },
      timestamp: Date.now(),
      snapshotId: sourceData.snapshotId,
      retrievedAt: sourceData.retrievedAt,
      totalResultsIsApproximate: sourceData.totalResultsIsApproximate,
      warnings: sourceData.warnings,
      enrichment: sourceData.enrichment,
      provenance: sourceData.provenance,
    });
  }, [data, cachedData, analytics, insights, submittedQuery, appliedFilters, setCachedResearch]);

  useEffect(() => {
    if (!submittedQuery || isFetching || !sourceData?.videos?.length || !analytics) return;
    saveResearchToCache();
  }, [analytics, isFetching, saveResearchToCache, sourceData, submittedQuery]);

  const handleSelectIdea = (idea: IdeaPackage) => {
    if (!sourceData || !insights?.evidenceClaims?.length) return;
    setSelectedIdea(idea);
    setIdeaData({
      selectedIdea: idea,
      generatedIdeas: ideaPackages,
      niche: submittedQuery,
      audience: insights.targetAudience?.primaryDemographic || "",
      evidenceContext: {
        snapshotId: sourceData.snapshotId,
        sourceVideoIds: sourceData.provenance.orderedVideoIds,
        evidenceClaims: insights.evidenceClaims,
        ideaPackage: idea,
      },
    });
  };

  const handleProceedToScript = () => {
    if (!selectedIdea) return;
    saveResearchToCache();
    handleSelectIdea(selectedIdea);
    goToStep("script");
    setLocation("/script");
  };

  const handleContinueWithoutAI = () => {
    saveResearchToCache();
    setIdeaData({
      selectedIdea: null,
      generatedIdeas: [],
      niche: submittedQuery,
      audience: "",
    });
    goToStep("script");
    setLocation("/script");
  };

  const handleRefreshResearch = async () => {
    insightAbortRef.current?.abort();
    ideaAbortRef.current?.abort();
    setInsights(null);
    setInsightsError(null);
    setInsightsErrorCategory(null);
    setIdeaPackages([]);
    setSelectedIdea(null);
    setIdeasLoading(false);
    setIdeasError(null);
    setIdeasErrorCategory(null);
    setExportError(null);
    insightsFetchedRef.current = "";
    ideasFetchedRef.current = "";
    await refetch();
  };

  const effectiveData = data || cachedData;
  const showLoading = isLoading || isFetching;
  const hasResults = effectiveData?.videos && effectiveData.videos.length > 0;
  const hasSearched = submittedQuery.length > 0;
  const displayedVideos = effectiveData?.videos || [];
  const searchError = error instanceof ResearchRequestError
    ? error
    : isError
      ? new ResearchRequestError({
          message: error instanceof Error ? error.message : t("research.error.searchFailed"),
          status: 0,
          category: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "unknown",
          retryable: true,
        })
      : null;
  const partialWarnings = effectiveData?.warnings || [];
  const incompleteEnrichmentStages = effectiveData?.enrichment
    ? Object.entries(effectiveData.enrichment).filter(([, stage]) => stage.status !== "complete")
    : [];
  const hasPartialEnrichment = partialWarnings.length > 0 || incompleteEnrichmentStages.length > 0;
  const exportPipelineLoading = Boolean(
    showLoading
    || insightsLoading
    || ideasLoading
    || (hasResults && !insights && !insightsError)
    || (hasResults && insights && ideaPackages.length === 0 && !ideasError),
  );
  const exportReady = Boolean(
    hasResults
    && analytics
    && insights
    && ideaPackages.length > 0
    && !showLoading
    && !insightsLoading
    && !ideasLoading,
  );
  const exportDisabled = !exportReady || exporting !== null;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col min-h-full relative">
        <StarryBackground />
        <div className="relative z-10 border-b border-border bg-background/95">
          <div className="mx-auto w-full max-w-[1680px] space-y-4 p-4 lg:p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div
                key={animationKey}
                className={`relative flex-1 transition-all duration-500 ${
                  workflowState.highlightSearchBox
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-md animate-pulse"
                    : ""
                }`}
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="search"
                  aria-label={t("research.searchAriaLabel")}
                  placeholder={t("research.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={handleSearchFocus}
                  className="pl-10 h-11"
                  data-testid="input-search"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={!searchQuery.trim() || showLoading}
                className="h-11 px-6"
                data-testid="button-search"
              >
                {showLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {t("common.search")}
              </Button>
            </div>

            <SearchFilters
              uploadDate={uploadDate}
              duration={duration}
              sortBy={sortBy}
              language={language}
              onUploadDateChange={setUploadDate}
              onDurationChange={setDuration}
              onSortByChange={setSortBy}
              onLanguageChange={setLanguage}
            />
            {hasSearched && (
              <p className="text-xs text-muted-foreground">
                {t("research.filtersDraftHint")}
              </p>
            )}
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1680px] flex-1 p-4 lg:p-6">
          {searchError && !showLoading && (() => {
            const presentation = errorPresentation(searchError.category);
            const ErrorIcon = presentation.icon;
            const keyError = searchError.category === "missing_key" || searchError.category === "invalid_key";
            return (
              <Alert variant="destructive" className="mb-6" data-testid={`alert-search-${searchError.category}`}>
                <ErrorIcon className="h-4 w-4" />
                <AlertTitle>{presentation.title}</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{withDetail(searchError)}</p>
                  <div className="flex flex-wrap gap-2">
                    {keyError && (
                      <Button size="sm" variant="outline" onClick={() => setLocation("/settings")}>
                        {t("research.openSettings")}
                      </Button>
                    )}
                    {(searchError.retryable || !keyError) && (
                      <Button size="sm" variant="outline" onClick={() => void refetch()}>
                        {t("research.retrySearch")}
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            );
          })()}
          {showLoading ? (
            <div className="space-y-8">
              <OverviewSkeleton />
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <VideoIcon className="h-5 w-5" />
                  {t("research.videosHeading")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <VideoCardSkeleton key={i} />
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  {t("research.aiInsightsHeading")}
                </h2>
                <InsightsSkeleton />
              </div>
            </div>
          ) : hasResults ? (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground" data-testid="text-results-count">
                  {t("research.resultsSummary", {
                    total: effectiveData?.totalResults?.toLocaleString(locale) || 0,
                    query: submittedQuery,
                    count: effectiveData?.videos.length || 0,
                    retrieved: effectiveData?.retrievedAt
                      ? t("research.resultsRetrievedAt", { date: new Date(effectiveData.retrievedAt).toLocaleString(locale) })
                      : "",
                  })}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={handleRefreshResearch}
                    disabled={showLoading}
                    data-testid="button-refresh"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("research.refresh")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleExport("pdf")}
                    disabled={exportDisabled}
                    aria-describedby={exportPipelineLoading ? "export-pipeline-status" : undefined}
                    data-testid="button-download-pdf"
                  >
                    {exportPipelineLoading || exporting === "pdf" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {exportPipelineLoading ? t("research.export.waiting", { format: "PDF" }) : exporting === "pdf" ? t("research.export.creating", { format: "PDF" }) : t("research.export.download", { format: "PDF" })}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleExport("xls")}
                    disabled={exportDisabled}
                    aria-describedby={exportPipelineLoading ? "export-pipeline-status" : undefined}
                    data-testid="button-download-xls"
                  >
                    {exportPipelineLoading || exporting === "xls" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                    )}
                    {exportPipelineLoading ? t("research.export.waiting", { format: "XLS" }) : exporting === "xls" ? t("research.export.creating", { format: "XLS" }) : t("research.export.download", { format: "XLS" })}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleExport("csv")}
                    disabled={exportDisabled}
                    aria-describedby={exportPipelineLoading ? "export-pipeline-status" : undefined}
                    data-testid="button-download-csv"
                  >
                    {exportPipelineLoading || exporting === "csv" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Table2 className="h-4 w-4 mr-2" />
                    )}
                    {exportPipelineLoading ? t("research.export.waiting", { format: "CSV" }) : exporting === "csv" ? t("research.export.creating", { format: "CSV" }) : t("research.export.download", { format: "CSV" })}
                  </Button>
                  {insightsError && (
                    <Button onClick={handleContinueWithoutAI} className="gap-1" data-testid="button-continue-without-ai">
                      {t("research.continueWithoutAi")}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>

              {exportPipelineLoading && (
                <p id="export-pipeline-status" className="text-xs text-muted-foreground" role="status" aria-live="polite">
                  {t("research.exportPipelineStatus")}
                </p>
              )}

              {exportError && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t("research.exportErrorTitle")}</AlertTitle>
                  <AlertDescription>{exportError}</AlertDescription>
                </Alert>
              )}

              {insightsError && (
                <Alert data-testid={`alert-insights-${insightsErrorCategory || "unknown"}`}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t("research.insightsUnavailableTitle")}</AlertTitle>
                  <AlertDescription>
                    {t("research.insightsUnavailableDescription")}
                  </AlertDescription>
                </Alert>
              )}

              {hasPartialEnrichment && (
                <Alert data-testid="alert-partial-enrichment">
                  <Database className="h-4 w-4" />
                  <AlertTitle>{t("research.partialEnrichmentTitle")}</AlertTitle>
                  <AlertDescription>
                    {partialWarnings.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5">
                        {partialWarnings.map((warning, index) => (
                          <li key={`${warningText(warning)}-${index}`}>{warningText(warning)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>
                        {incompleteEnrichmentStages.map(([name, stage]) => (
                          t("research.partialEnrichmentStage", { label: enrichmentKeyLabel(name), returned: stage.returned, requested: stage.requested })
                        )).join("; ")}.
                      </p>
                    )}
                    <p className="mt-2">{t("research.partialEnrichmentNote")}</p>
                  </AlertDescription>
                </Alert>
              )}

              {analytics && (
                <section className="scroll-mt-40 space-y-5" aria-labelledby="research-overview-heading">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 id="research-overview-heading" className="text-lg font-semibold flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        {t("research.overviewHeading")}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("research.overviewDescription")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-success-subtle bg-success-subtle text-success">
                        {t("research.badge.observedPublicData")}
                      </Badge>
                      <Badge variant="outline" className="border-info-subtle bg-info-subtle text-info">
                        {t("research.badge.channels", { count: analytics.uniqueChannels })}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Eye className="h-4 w-4" />
                          <span className="text-xs font-medium">{t("research.stat.sampleViews")}</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="stat-total-views">
                          {formatNumber(analytics.totalViews)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{t("research.stat.sampleViewsHint")}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-xs font-medium">{t("research.stat.medianViews")}</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="stat-avg-views">
                          {formatNumber(analytics.medianViews)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{t("research.stat.medianViewsHint")}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Activity className="h-4 w-4" />
                          <span className="text-xs font-medium">{t("research.stat.medianDailyViews")}</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="stat-median-views-day">
                          {formatNumber(analytics.medianDailyViews)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{t("research.stat.medianDailyViewsHint")}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Users className="h-4 w-4" />
                          <span className="text-xs font-medium">{t("research.stat.engagementRate")}</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="stat-avg-engagement">
                          {analytics.avgEngagement === "N/A" ? t("common.notAvailable") : t("research.percentValue", { value: Number(analytics.avgEngagement).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {t("research.stat.engagementRateHint", { complete: analytics.coverage.engagement, total: analytics.totalVideos })}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-xs font-medium">{t("research.stat.avgViews")}</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="stat-avg-views">
                          {formatNumber(analytics.avgViews)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{t("research.stat.avgViewsHint")}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <VideoIcon className="h-4 w-4" />
                          <span className="text-xs font-medium">{t("research.stat.videosAnalyzed")}</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="stat-videos-analyzed">
                          {analytics.totalVideos}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{t("research.stat.videosAnalyzedHint")}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          {t("research.topVideosByViews")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analytics.topVideosList.map((video, index) => {
                            const maxViews = analytics.topVideosList[0]?.viewCount || 1;
                            const barWidth = ((video.viewCount || 0) / maxViews) * 100;
                            return (
                              <a
                                key={video.id}
                                href={`https://www.youtube.com/watch?v=${video.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block group"
                                data-testid={`top-video-bar-${index}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate group-hover:text-info transition-colors flex items-center gap-1">
                                      {video.title}
                                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </p>
                                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted/70">
                                      <div
                                        className="h-full rounded-full transition-opacity group-hover:opacity-80"
                                        style={{ width: `${barWidth}%`, backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                                      />
                                    </div>
                                  </div>
                                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                    {video.viewCount === undefined ? t("common.notAvailable") : formatNumber(video.viewCount)}
                                  </span>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="self-start">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {t("research.durationMix")}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{t("research.durationMixDescription")}</p>
                      </CardHeader>
                      <CardContent className="grid items-center gap-4 sm:grid-cols-[170px_1fr] xl:grid-cols-1 2xl:grid-cols-[170px_1fr]">
                        <div className="mx-auto h-[170px] w-[170px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={analytics.durationData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={46}
                                outerRadius={72}
                                paddingAngle={2}
                                stroke="hsl(var(--card))"
                                strokeWidth={3}
                              >
                                {analytics.durationData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number) => [t("research.videosCount", { count: value }), t("research.tooltip.sample")]}
                                contentStyle={{
                                  background: "hsl(var(--popover))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: 8,
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-3">
                          {analytics.durationData.map((item, index) => {
                            const percentage = analytics.totalVideos > 0
                              ? Math.round((item.value / analytics.totalVideos) * 100)
                              : 0;
                            return (
                              <div key={item.name} className="flex items-center gap-3">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">{t("research.percentOfSample", { percent: percentage })}</p>
                                </div>
                                <span className="text-sm font-semibold">{item.value}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">
                    <Card className="self-start">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          {t("research.momentumLeaders")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {analytics.velocityLeaders.map(({ video, viewsPerDay }, index) => (
                          <a
                            key={video.id}
                            href={`https://www.youtube.com/watch?v=${video.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/10 p-3 transition-colors hover:border-[hsl(var(--info)/.35)] hover:bg-[hsl(var(--info)/.05)]"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info-subtle text-xs font-semibold text-info">{index + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{video.title}</p>
                              <p className="text-xs text-muted-foreground">{video.channelTitle}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">{formatNumber(Math.round(viewsPerDay))}</p>
                              <p className="text-[11px] text-muted-foreground">{t("research.viewsPerDay")}</p>
                            </div>
                          </a>
                        ))}
                        <p className="text-xs text-muted-foreground">
                          {t("research.momentumNote")}
                        </p>
                        {analytics.breakoutLeaders.length > 0 && (
                          <div className="space-y-2 border-t border-border pt-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t("research.breakoutHeading")}
                            </p>
                            {analytics.breakoutLeaders.slice(0, 3).map(({ video, viewsPerSubscriber }) => (
                              <div key={video.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="truncate">{video.title}</span>
                                <Badge variant="outline">{viewsPerSubscriber.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x</Badge>
                              </div>
                            ))}
                            <p className="text-xs text-muted-foreground">
                              {t("research.breakoutNote")}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="space-y-5">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {t("research.recencyHeading")}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{t("research.recencyDescription")}</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {analytics.recencyData.map((item, index) => {
                          const percentage = analytics.totalVideos > 0
                            ? Math.round((item.value / analytics.totalVideos) * 100)
                            : 0;
                          return (
                            <div key={item.name} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span>{item.name}</span>
                                <span className="text-muted-foreground">{item.value} <span className="text-xs">({percentage}%)</span></span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${percentage}%`, backgroundColor: BAR_COLORS[(index + 1) % BAR_COLORS.length] }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          {t("research.coverageHeading")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-x-4 gap-y-3 2xl:grid-cols-2">
                        {[
                          [t("research.coverage.views"), analytics.coverage.views],
                          [t("research.coverage.engagement"), analytics.coverage.engagement],
                          [t("research.coverage.subscribers"), analytics.coverage.subscribers],
                          [t("research.coverage.tags"), analytics.coverage.tags],
                          [t("research.coverage.captions"), analytics.coverage.captions],
                          [t("research.coverage.hd"), analytics.coverage.hd],
                        ].map(([label, count]) => {
                          const numericCount = Number(count);
                          const percentage = analytics.totalVideos > 0
                            ? Math.round((numericCount / analytics.totalVideos) * 100)
                            : 0;
                          return (
                            <div key={String(label)} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{label}</span>
                                <span className="text-muted-foreground">{numericCount}/{analytics.totalVideos}</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-success" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-xs text-muted-foreground 2xl:col-span-2">
                          {t("research.coverageNote")}
                        </p>
                      </CardContent>
                    </Card>
                    </div>
                  </div>

                  {outlierLeaders.length > 0 && (
                    <Card data-testid="card-outlier-videos">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          {t("research.outlierHeading")}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {t("research.outlierDescription")}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {outlierLeaders.map((video, index) => (
                          <a
                            key={video.id}
                            href={`https://www.youtube.com/watch?v=${video.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/10 p-3 transition-colors hover:border-[hsl(var(--info)/.35)] hover:bg-[hsl(var(--info)/.05)]"
                            data-testid={`outlier-video-${index}`}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info-subtle text-xs font-semibold text-info">{index + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{video.title}</p>
                              <p className="text-xs text-muted-foreground">{video.channelTitle}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3 text-right">
                              <Badge variant="outline" className="font-semibold">
                                {video.outlierScore.toLocaleString(locale, { maximumFractionDigits: 1 })}x
                              </Badge>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {t("research.outlierViews", { views: video.viewCount === undefined ? t("common.notAvailable") : formatNumber(video.viewCount) })}
                              </span>
                            </div>
                          </a>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  <div>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          {t("research.recurringTags")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {analytics.topTags.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {analytics.topTags.map((tag) => (
                              <Badge key={tag.label} variant="secondary">
                                {tag.label} <span className="ml-1 text-muted-foreground">{tag.count}</span>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{t("research.noTags")}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </section>
              )}

              <section className="scroll-mt-40 space-y-4 border-t border-border/70 pt-7" aria-labelledby="research-videos-heading">
                <div>
                  <h2 id="research-videos-heading" className="text-lg font-semibold flex items-center gap-2">
                    <VideoIcon className="h-5 w-5" />
                    {t("research.sourceVideosHeading", { count: displayedVideos.length })}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("research.sourceVideosDescription")}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {displayedVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      onClick={handleVideoClick}
                    />
                  ))}
                </div>
              </section>

              <section className="scroll-mt-40 space-y-4 border-t border-border/70 pt-7" aria-labelledby="research-insights-heading">
                <div>
                  <h2 id="research-insights-heading" className="text-lg font-semibold flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    {t("research.aiInsightsHeading")}
                    {insightsLoading && (
                      <Badge variant="secondary" className="ml-2 ai-insights-glow">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        {t("research.insightsGeneratingBadge")}
                      </Badge>
                    )}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("research.insightsDescription")}
                  </p>
                </div>

                {insightsLoading ? (
                  <InsightsSkeleton />
                ) : insights ? (
                  <div className="space-y-6">
                    <Card className="border-info-subtle bg-info-subtle">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <Sparkles className="mt-0.5 h-5 w-5 text-info" />
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{t("research.strategicSummary")}</h3>
                              <Badge variant="outline">{t("research.aiInference")}</Badge>
                              {insights.methodology?.sampleSize !== undefined && (
                                <Badge variant="secondary">{t("research.videosCount", { count: insights.methodology.sampleSize })}</Badge>
                              )}
                            </div>
                            <p className="text-sm leading-relaxed">
                              {insights.summary || t("research.summaryFallback")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("research.insightsOverviewAria")}>
                      {[
                        { label: t("research.stat.questions"), value: insights.peopleAlsoAsk?.length || 0, icon: HelpCircle, color: "text-info bg-info-subtle" },
                        { label: t("research.stat.opportunities"), value: insights.contentGaps?.length || 0, icon: Lightbulb, color: "text-warning bg-warning-subtle" },
                        { label: t("research.stat.topics"), value: insights.trendingSubtopics?.length || 0, icon: TrendingUp, color: "text-success bg-success-subtle" },
                        { label: t("research.stat.nextSteps"), value: insights.recommendedActions?.length || 0, icon: ListChecks, color: "text-primary bg-primary/10" },
                      ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color}`}>
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-2xl font-semibold tabular-nums">{value}</p>
                            <p className="text-xs text-muted-foreground">{label}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {insights.queryIntent && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Compass className="h-4 w-4 text-info" />
                            {t("research.perspectiveHeading")}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {t("research.perspectiveDescription")}
                          </p>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          {[
                            [t("research.perspective.primaryIntent"), insights.queryIntent.primaryIntent],
                            [t("research.perspective.viewerNeed"), insights.queryIntent.viewerNeed],
                            [t("research.perspective.discoverySurface"), insights.queryIntent.discoverySurface],
                            [t("research.perspective.credibility"), insights.queryIntent.credibilityNote],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-lg border border-border/70 bg-muted/15 p-4">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                              <p className="mt-2 text-sm leading-relaxed">{value}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {insights.evidenceSignals && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="h-4 w-4 text-info" aria-hidden="true" />
                            {t("research.evidenceBalanceHeading")}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">{t("research.evidenceBalanceDescription")}</p>
                        </CardHeader>
                        <CardContent className="grid gap-3 lg:grid-cols-3">
                        {[
                          {
                            title: t("research.evidence.observed"),
                            description: t("research.evidence.observedDescription"),
                            items: insights.evidenceSignals.observed,
                            icon: CheckCircle2,
                            color: "border-success-subtle bg-success-subtle",
                            accent: "bg-success",
                            text: "text-success",
                          },
                          {
                            title: t("research.evidence.inferred"),
                            description: t("research.evidence.inferredDescription"),
                            items: insights.evidenceSignals.inferred,
                            icon: Lightbulb,
                            color: "border-warning-subtle bg-warning-subtle",
                            accent: "bg-warning",
                            text: "text-warning",
                          },
                          {
                            title: t("research.evidence.requiresStudio"),
                            description: t("research.evidence.requiresStudioDescription"),
                            items: insights.evidenceSignals.requiresStudio,
                            icon: FlaskConical,
                            color: "border-info-subtle bg-info-subtle",
                            accent: "bg-info",
                            text: "text-info",
                          },
                        ].map(({ title, description, items, icon: Icon, color, accent, text }) => (
                          <div key={title} className={`rounded-xl border p-4 ${color}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-background/70 ${text}`}>
                                  <Icon className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div>
                                  <p className="font-semibold">{title}</p>
                                  <p className="text-xs text-muted-foreground">{description}</p>
                                </div>
                              </div>
                              <span className={`text-3xl font-semibold tabular-nums ${text}`}>{items?.length || 0}</span>
                            </div>
                            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background/70" aria-hidden="true">
                              <div
                                className={`h-full rounded-full ${accent}`}
                                style={{ width: `${Math.max(12, Math.min(100, (items?.length || 0) * 24))}%` }}
                              />
                            </div>
                            <details className="mt-3 text-sm text-foreground">
                              <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">{t("research.showResults")}</summary>
                              <ul className="mt-3 space-y-2">
                                {items?.map((item, index) => (
                                  <li key={index} className="flex items-start gap-2">
                                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent}`} aria-hidden="true" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </div>
                        ))}
                        </CardContent>
                      </Card>
                    )}

                    {insights.evidenceClaims && insights.evidenceClaims.length > 0 && (
                      <Collapsible open={evidenceLedgerOpen} onOpenChange={setEvidenceLedgerOpen}>
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Database className="h-4 w-4" aria-hidden="true" />
                                {t("research.evidenceLedgerHeading")}
                                <Badge variant="secondary">{t("research.claimsCount", { count: insights.evidenceClaims.length })}</Badge>
                              </CardTitle>
                              <p className="mt-1 text-xs text-muted-foreground">{t("research.evidenceLedgerDescription")}</p>
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2">
                                {evidenceLedgerOpen ? t("research.hideDetails") : t("research.showEvidence")}
                                {evidenceLedgerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent className="space-y-3 border-t border-border/70 pt-5">
                          {insights.evidenceClaims.map((claim) => (
                            <article key={claim.id} className="rounded-lg border border-border/70 bg-muted/10 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{labelFor(EVIDENCE_CLASS_LABELS, claim.evidenceClass)}</Badge>
                                <Badge variant="secondary">{t("research.confidence", { value: labelFor(CONFIDENCE_LABELS, claim.confidence) })}</Badge>
                                <span className="font-mono text-[11px] text-muted-foreground">{claim.id}</span>
                              </div>
                              <p className="mt-3 text-sm leading-relaxed">{claim.claim}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                {claim.sourceVideoIds.length > 0 ? (
                                  claim.sourceVideoIds.map((videoId) => {
                                    const sourceVideo = sourceData?.videos.find((video) => video.id === videoId);
                                    return (
                                      <a
                                        key={videoId}
                                        href={`https://www.youtube.com/watch?v=${videoId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded-full border border-info-subtle bg-info-subtle px-2.5 py-1 text-info hover:underline"
                                      >
                                        {sourceVideo?.title || videoId}
                                      </a>
                                    );
                                  })
                                ) : (
                                  <span className="rounded-full border border-warning-subtle bg-warning-subtle px-2.5 py-1 text-warning">
                                    {t("research.aggregatedInference", { id: claim.snapshotId.slice(0, 10) })}
                                  </span>
                                )}
                              </div>
                              <p className="mt-3 text-xs text-muted-foreground">
                                {t("research.limitation", { text: claim.limitations.join(" ") })}
                              </p>
                            </article>
                          ))}
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <HelpCircle className="h-4 w-4" />
                          {t("research.viewerQuestionsHeading")}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {t("research.viewerQuestionsDescription")}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {insights.peopleAlsoAsk?.map((item, index) => (
                          <Collapsible
                            key={index}
                            open={expandedQuestions.has(index)}
                            onOpenChange={() => toggleQuestion(index)}
                          >
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                className="w-full justify-between text-left h-auto py-3 px-4"
                                data-testid={`button-question-${index}`}
                              >
                                <span className="font-medium">{item.question}</span>
                                {expandedQuestions.has(index) ? (
                                  <ChevronUp className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-4 pb-3">
                              <p className="text-sm text-muted-foreground">{item.answer}</p>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            {t("research.audienceHeading")}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">{t("research.audienceDescription")}</p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">{t("research.audience.primaryDemographic")}</p>
                            <p className="text-sm">{insights.targetAudience?.primaryDemographic}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">{t("research.audience.ageRange")}</p>
                            <Badge variant="secondary">{insights.targetAudience?.ageRange}</Badge>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">{t("research.audience.interests")}</p>
                            <div className="flex flex-wrap gap-2">
                              {insights.targetAudience?.interests?.map((interest, i) => (
                                <Badge key={i} variant="outline">{interest}</Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">{t("research.audience.painPoints")}</p>
                            <ul className="text-sm space-y-1">
                              {insights.targetAudience?.painPoints?.map((point, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-warning">•</span>
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            {t("research.nicheHeading")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">{t("research.niche.competitionSignal")}</p>
                              <Badge
                                variant="outline"
                                className={insights.nicheAnalysis?.competitionLevel?.toLowerCase().includes("high")
                                  ? "border-warning-subtle bg-warning-subtle text-warning"
                                  : "border-info-subtle bg-info-subtle text-info"}
                              >
                                {insights.nicheAnalysis?.competitionLevel?.split(" ")[0]}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">{t("research.niche.demandSignal")}</p>
                              <Badge variant="outline" className="border-success-subtle bg-success-subtle text-success">
                                {insights.nicheAnalysis?.growthTrend?.split(" ")[0]}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">{t("research.niche.postingRhythm")}</p>
                            <div className="flex flex-wrap gap-2">
                              {insights.nicheAnalysis?.bestPostingTimes?.map((time, i) => (
                                <Badge key={i} variant="outline">{time}</Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">{t("research.niche.recommendedFormats")}</p>
                            <ul className="text-sm space-y-1">
                              {insights.nicheAnalysis?.recommendedFormats?.map((format, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-info">•</span>
                                  {format}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">{t("research.niche.commercialIntent")}</p>
                            <p className="text-sm">{insights.nicheAnalysis?.monetizationPotential}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Lightbulb className="h-4 w-4" />
                            {t("research.opportunitiesHeading")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {insights.contentGaps?.map((gap, i) => (
                              <li key={i} className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2 text-sm">
                                <details>
                                  <summary className="cursor-pointer select-none font-medium">
                                    <span className="mr-2 text-info">{i + 1}.</span>
                                    {scanLabel(gap, t("research.opportunityFallback", { n: i + 1 }))}
                                  </summary>
                                  <p className="mt-2 pl-6 leading-relaxed text-muted-foreground">{gap}</p>
                                </details>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            {t("research.subtopicsHeading")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {insights.trendingSubtopics?.map((topic, i) => (
                              <Badge key={i} variant="secondary" className="text-sm">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {insights.recommendedActions && insights.recommendedActions.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <ListChecks className="h-4 w-4" />
                            {t("research.nextStepsHeading")}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {t("research.nextStepsDescription")}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-4 md:grid-cols-3">
                            {insights.recommendedActions.map((action, index) => (
                              <div key={`${action.title}-${index}`} className="relative rounded-lg border border-border p-4">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-info-subtle text-sm font-bold text-info">
                                    {index + 1}
                                  </span>
                                  <Badge variant="outline">{action.format}</Badge>
                                </div>
                                <h4 className="font-semibold">{action.title}</h4>
                                <details className="mt-3 rounded-lg bg-muted/25 px-3 py-2">
                                  <summary className="cursor-pointer select-none text-xs font-medium text-info">{t("research.whyThisStep")}</summary>
                                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{action.rationale}</p>
                                </details>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {insights.methodology && (
                      <Collapsible open={methodologyOpen} onOpenChange={setMethodologyOpen}>
                        <Card className="bg-muted/20">
                          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Database className="h-4 w-4" />
                                {t("research.methodologyHeading")}
                              </CardTitle>
                              <p className="mt-1 text-xs text-muted-foreground">{t("research.methodologyDescription")}</p>
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-2">
                                {methodologyOpen ? t("research.hide") : t("research.checkLimits")}
                                {methodologyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent className="grid gap-4 border-t border-border/70 pt-5 md:grid-cols-[1fr_2fr]">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("research.methodology.basis")}</p>
                            <p className="mt-1 text-sm">{insights.methodology.basis}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("research.methodology.limitations")}</p>
                            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                              {insights.methodology.limitations.map((limitation, index) => (
                                <li key={index} className="flex gap-2">
                                  <span className="text-warning">•</span>
                                  <span>{limitation}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">
                        {insightsError ? aiErrorTitle(insightsErrorCategory) : t("research.insightsReadyTitle")}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {insightsError || t("research.insightsReadyDescription")}
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {(insightsErrorCategory === "missing_key" || insightsErrorCategory === "invalid_key") && (
                          <Button variant="outline" onClick={() => setLocation("/settings")}>{t("research.openSettings")}</Button>
                        )}
                        <Button
                          onClick={() => {
                            setInsightsError(null);
                            setInsightsErrorCategory(null);
                            void fetchInsights();
                          }}
                          disabled={insightsLoading}
                        >
                          {insightsLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Lightbulb className="h-4 w-4 mr-2" />
                          )}
                          {insightsError ? t("research.retryInsights") : t("research.generateInsights")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </section>

              <section
                id="ideas"
                className="scroll-mt-40 space-y-4 border-t border-border/70 pt-7"
                aria-labelledby="research-ideas-heading"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 id="research-ideas-heading" className="flex items-center gap-2 text-lg font-semibold">
                      <Sparkles className="h-5 w-5 text-info" aria-hidden="true" />
                      {t("research.ideasHeading")}
                      {ideasLoading && (
                        <Badge variant="secondary" role="status" aria-live="polite">
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
                          {t("research.ideasGeneratingBadge")}
                        </Badge>
                      )}
                    </h2>
                    <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                      {t("research.ideasDescription")}
                    </p>
                  </div>
                  {selectedIdea && (
                    <Button onClick={handleProceedToScript} className="gap-2" data-testid="button-proceed-script">
                      <PlayCircle className="h-4 w-4" aria-hidden="true" />
                      {t("research.proceedToScript")}
                    </Button>
                  )}
                </div>

                {ideasLoading ? (
                  <IdeasSkeleton />
                ) : ideasError ? (
                  <Alert data-testid={`alert-ideas-${ideasErrorCategory || "unknown"}`}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t("research.ideasUnavailableTitle")}</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>{ideasError}</p>
                      <div className="flex flex-wrap gap-2">
                        {(ideasErrorCategory === "missing_key" || ideasErrorCategory === "invalid_key") && (
                          <Button size="sm" variant="outline" onClick={() => setLocation("/settings")}>{t("research.openSettings")}</Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIdeasError(null);
                            setIdeasErrorCategory(null);
                            ideasFetchedRef.current = "";
                            void fetchIdeas();
                          }}
                        >
                          {t("research.retryIdeas")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleContinueWithoutAI}>
                          {t("research.continueWithoutAi")}
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : ideaPackages.length > 0 ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {ideaPackages.map((idea, index) => {
                        const isSelected = selectedIdea?.title === idea.title;
                        return (
                          <button
                            key={`${idea.title}-${index}`}
                            type="button"
                            onClick={() => handleSelectIdea(idea)}
                            aria-pressed={isSelected}
                            className={`rounded-xl border bg-card p-5 text-left text-card-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              isSelected
                                ? "border-primary/60 bg-primary/5"
                                : "border-card-border hover:border-primary/35 hover:bg-muted/20"
                            }`}
                            data-testid={`button-grounded-idea-${index}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("research.ideaLabel", { n: index + 1 })}</p>
                                <h3 className="mt-1 font-semibold leading-snug">{idea.title}</h3>
                              </div>
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                              }`} aria-hidden="true">
                                {isSelected && <CheckCircle2 className="h-4 w-4" />}
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge variant="outline">{labelFor(IDEA_FORMAT_LABELS, idea.format)}</Badge>
                              <Badge variant="secondary">{labelFor(DISCOVERY_SURFACE_LABELS, idea.discoverySurface)}</Badge>
                              <Badge variant="outline">{labelFor(DIFFICULTY_LABELS, idea.difficulty)}</Badge>
                            </div>

                            <p className="mt-4 text-sm text-muted-foreground">{idea.description}</p>

                            <div className="mt-4 space-y-3 border-t border-border/70 pt-4 text-sm">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-info">{t("research.idea.honestPromise")}</p>
                                <p className="mt-1">{idea.honestPromise}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("research.idea.payoff")}</p>
                                <p className="mt-1">{idea.payoff}</p>
                              </div>
                              <div className="flex items-start gap-2">
                                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                                <p>{idea.thumbnailConcept}</p>
                              </div>
                              <div className="rounded-lg bg-info-subtle p-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-info">{t("research.idea.studioTest")}</p>
                                <p className="mt-1">{idea.studioMetric}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{idea.experimentRule}</p>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-1.5" aria-label={t("research.evidenceUsedAria")}>
                              {Array.from(new Set(idea.evidenceClaims.map((claim) => claim.evidenceClass))).map((evidenceClass) => (
                                <Badge key={evidenceClass} variant="outline" className="text-[11px]">
                                  {labelFor(EVIDENCE_CLASS_LABELS, evidenceClass)}
                                </Badge>
                              ))}
                              <Badge variant="secondary" className="text-[11px]">
                                {t("research.sourceVideosCount", { count: new Set(idea.evidenceClaims.flatMap((claim) => claim.sourceVideoIds)).size })}
                              </Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">
                          {selectedIdea ? t("research.selectedIdea", { title: selectedIdea.title }) : t("research.selectIdeaPrompt")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("research.selectionNote")}
                        </p>
                      </div>
                      <Button onClick={handleProceedToScript} disabled={!selectedIdea} className="shrink-0 gap-2">
                        {t("research.proceedToScript")}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </>
                ) : insightsLoading ? (
                  <Card>
                    <CardContent className="py-10 text-center" role="status" aria-live="polite">
                      <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-info" aria-hidden="true" />
                      <p className="font-medium">{t("research.waitingInsightsTitle")}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{t("research.waitingInsightsDescription")}</p>
                    </CardContent>
                  </Card>
                ) : !insights ? (
                  <Card>
                    <CardContent className="py-10 text-center">
                      <Lightbulb className="mx-auto mb-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
                      <p className="font-medium">{t("research.ideasRequireInsightsTitle")}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{t("research.ideasRequireInsightsDescription")}</p>
                      {insightsError && (
                        <Button variant="outline" className="mt-4" onClick={handleContinueWithoutAI}>{t("research.continueWithoutAi")}</Button>
                      )}
                    </CardContent>
                  </Card>
                ) : null}
              </section>
            </div>
          ) : searchError ? null : hasSearched ? (
            <EmptyState
              icon={VideoIcon}
              title={t("research.emptyNoVideosTitle")}
              description={t("research.emptyNoVideosDescription", { query: submittedQuery })}
            />
          ) : (
            <EmptyState
              icon={Search}
              title={t("research.emptyStartTitle")}
              description={t("research.emptyStartDescription")}
            />
          )}
        </div>

        <VideoDetailDialog
          video={selectedVideo}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </div>
    </ScrollArea>
  );
}
