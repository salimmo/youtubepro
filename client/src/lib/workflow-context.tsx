import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type {
  EvidenceClaim,
  IdeaPackage,
  ScriptEvidenceContext,
  ScriptResult,
  SearchResponse,
  Video,
} from "@shared/schema";
import {
  deriveWorkflowTitle,
  normalizeCustomWorkflowTitle,
  sortAndLimitWorkflowSummaries,
  type WorkflowHistorySummary,
} from "@shared/workflow-history";
import {
  clearLegacyIndexedDb,
  deleteWorkflowRecord,
  getWorkflowRecord,
  listWorkflowSummaries,
  pruneWorkflowRecords,
  putWorkflowRecord,
  readLegacyIndexedDbRecords,
  type StoredWorkflowRecord,
} from "@/lib/workflow-storage";
import { useAuth } from "@/lib/auth-context";

interface ResearchInsights {
  peopleAlsoAsk?: { question: string; answer: string }[];
  targetAudience?: {
    primaryDemographic: string;
    ageRange: string;
    interests: string[];
    painPoints?: string[];
    contentPreferences?: string[];
  };
  nicheAnalysis?: {
    competitionLevel: string;
    growthTrend: string;
    bestPostingTimes: string[];
    recommendedFormats: string[];
    monetizationPotential: string;
  };
  contentGaps?: string[];
  trendingSubtopics?: string[];
  evidenceClaims?: EvidenceClaim[];
}

interface CachedAnalytics {
  totalViews: number;
  avgViews: number;
  avgEngagement: string;
  totalVideos: number;
  totalEngagement: number;
  viewsDistribution: { name: string; views: number; likes: number }[];
  durationData: { name: string; value: number }[];
  topVideo: Video | null;
  topVideosList: Video[];
}

interface CachedResearchData {
  query: string;
  totalResults: number;
  resultsPerPage?: number;
  regionCode?: string;
  nextPageToken?: string;
  videos: Video[];
  insights: ResearchInsights | null;
  analytics: CachedAnalytics | null;
  filters: { uploadDate: string; duration: string; sortBy: string };
  timestamp: number;
  snapshotId?: string;
  retrievedAt?: string;
  totalResultsIsApproximate?: boolean;
  warnings?: SearchResponse["warnings"];
  enrichment?: SearchResponse["enrichment"];
  provenance?: SearchResponse["provenance"];
}

interface IdeaData {
  selectedIdea: IdeaPackage | null;
  generatedIdeas?: IdeaPackage[];
  niche: string;
  audience: string;
  evidenceContext?: ScriptEvidenceContext;
}

interface ScriptData {
  script: string;
  topic: string;
  title?: string;
  format: string;
  audience: string;
  persona?: string;
  keywords?: string[];
  wordCount?: number;
  estimatedDuration?: string;
  customPersona?: string;
  additionalNotes?: string;
  timestamp: number;
  evidenceContext?: ScriptEvidenceContext;
  result?: ScriptResult;
}

interface ThumbnailData {
  topic: string;
  thumbnailStyle: string;
  mainText: string;
  subText: string;
  description: string;
  composition: string;
  cameraAngle: string;
  lighting: string;
  colorScheme: string;
  textPosition: string;
  presetId: string;
  autoBlend: boolean;
  thumbnailData: string | null;
  resultModel: string | null;
  timestamp: number;
}

export type WorkflowStep = "research" | "script" | "thumbnail";

interface WorkflowState {
  id: string | null;
  title: string;
  customTitle: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  currentStep: WorkflowStep;
  isWorkflowActive: boolean;
  cachedResearch: CachedResearchData | null;
  idea: IdeaData | null;
  cachedScript: ScriptData | null;
  cachedThumbnail: ThumbnailData | null;
  highlightSearchBox: boolean;
  highlightTrigger: number;
}

interface WorkflowContextType {
  state: WorkflowState;
  recentWorkflows: WorkflowHistorySummary[];
  historyLoading: boolean;
  historyError: string | null;
  startWorkflow: () => void;
  openWorkflow: (id: string) => Promise<WorkflowStep | null>;
  renameWorkflow: (id: string, title: string) => Promise<boolean>;
  removeWorkflow: (id: string) => Promise<WorkflowStep | null>;
  endWorkflow: () => void;
  setCachedResearch: (data: CachedResearchData) => void;
  setIdeaData: (data: IdeaData) => void;
  setScriptData: (data: ScriptData) => void;
  setThumbnailData: (data: ThumbnailData) => void;
  clearScriptCache: () => void;
  goToStep: (step: WorkflowStep | "ideas") => void;
  clearWorkflow: () => void;
  clearHighlight: () => void;
  clearResearchCache: () => void;
}

const LEGACY_STORAGE_KEY = "youtube_research_workflow";
const ACTIVE_WORKFLOW_KEY = "youtube_pro_active_workflow";

function createEmptyState(id: string | null = null, now: number | null = null): WorkflowState {
  return {
    id,
    title: "Unbenannter Workflow",
    customTitle: null,
    createdAt: now,
    updatedAt: now,
    currentStep: "research",
    isWorkflowActive: Boolean(id),
    cachedResearch: null,
    idea: null,
    cachedScript: null,
    cachedThumbnail: null,
    highlightSearchBox: false,
    highlightTrigger: 0,
  };
}

function createWorkflowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStep(step: unknown): WorkflowStep {
  return step === "script" || step === "thumbnail" ? step : "research";
}

function restorableStep(state: WorkflowState): WorkflowStep {
  if (state.currentStep === "thumbnail" && state.cachedThumbnail) return "thumbnail";
  if (state.currentStep === "script" && state.cachedScript?.script) return "script";
  if (state.currentStep === "research" && state.cachedResearch) return "research";
  if (state.cachedThumbnail?.thumbnailData) return "thumbnail";
  if (state.cachedScript?.script) return "script";
  return "research";
}

function normalizeState(value: Partial<WorkflowState>, fallbackId?: string): WorkflowState {
  const now = Date.now();
  const id = typeof value.id === "string" && value.id ? value.id : fallbackId || createWorkflowId();
  const createdAt = typeof value.createdAt === "number" ? value.createdAt : now;
  const normalized: WorkflowState = {
    ...createEmptyState(id, createdAt),
    ...value,
    id,
    title: "Unbenannter Workflow",
    customTitle: typeof value.customTitle === "string" ? normalizeCustomWorkflowTitle(value.customTitle) : null,
    createdAt,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : createdAt,
    currentStep: normalizeStep(value.currentStep),
    isWorkflowActive: true,
    cachedResearch: value.cachedResearch || null,
    idea: value.idea || null,
    cachedScript: value.cachedScript || null,
    cachedThumbnail: value.cachedThumbnail || null,
    highlightSearchBox: false,
    highlightTrigger: 0,
  };
  return {
    ...normalized,
    title: normalized.customTitle || deriveWorkflowTitle({
      researchQuery: normalized.cachedResearch?.query,
      scriptTitle: normalized.cachedScript?.title,
      scriptTopic: normalized.cachedScript?.topic,
      thumbnailTopic: normalized.cachedThumbnail?.topic,
    }),
  };
}

function updateState(previous: WorkflowState, changes: Partial<WorkflowState>): WorkflowState {
  const now = Date.now();
  const next = {
    ...previous,
    ...changes,
    id: previous.id || createWorkflowId(),
    createdAt: previous.createdAt || now,
    updatedAt: now,
    isWorkflowActive: true,
  };
  return {
    ...next,
    title: next.customTitle || deriveWorkflowTitle({
      researchQuery: next.cachedResearch?.query,
      scriptTitle: next.cachedScript?.title,
      scriptTopic: next.cachedScript?.topic,
      thumbnailTopic: next.cachedThumbnail?.topic,
    }),
  };
}

function summaryFromState(state: WorkflowState): WorkflowHistorySummary | null {
  if (!state.id || !state.createdAt || !state.updatedAt) return null;
  return {
    id: state.id,
    title: state.title,
    currentStep: state.currentStep,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    hasResearch: Boolean(state.cachedResearch),
    hasScript: Boolean(state.cachedScript?.script),
    hasThumbnail: Boolean(state.cachedThumbnail?.thumbnailData),
  };
}

function recordToSummary(record: StoredWorkflowRecord<WorkflowState>): WorkflowHistorySummary | null {
  return summaryFromState(normalizeState(record.state, record.id));
}

function readLegacyState(): Partial<WorkflowState> | null {
  try {
    const stored = window.sessionStorage.getItem(LEGACY_STORAGE_KEY);
    return stored ? JSON.parse(stored) as Partial<WorkflowState> : null;
  } catch (error) {
    console.error("Failed to read the legacy workflow cache:", error);
    return null;
  }
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Der zuletzt geöffnete Workflow wird pro Benutzer gemerkt, damit sich
  // Benutzer im selben Browser nicht gegenseitig beeinflussen.
  const activeKeyRef = useRef(`${ACTIVE_WORKFLOW_KEY}:${user?.id ?? "anonymous"}`);
  activeKeyRef.current = `${ACTIVE_WORKFLOW_KEY}:${user?.id ?? "anonymous"}`;
  const rememberActive = useCallback((id: string) => {
    try {
      window.localStorage.setItem(activeKeyRef.current, id);
    } catch {
      // localStorage nicht verfügbar
    }
  }, []);
  const readActive = useCallback((): string | null => {
    try {
      return window.localStorage.getItem(activeKeyRef.current);
    } catch {
      return null;
    }
  }, []);
  const [state, setState] = useState<WorkflowState>(() => createEmptyState());
  const [recentWorkflows, setRecentWorkflows] = useState<WorkflowHistorySummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const queueSave = useCallback((nextState: WorkflowState) => {
    const summary = summaryFromState(nextState);
    if (!summary || !nextState.id || !nextState.createdAt || !nextState.updatedAt) return;
    setRecentWorkflows((current) => sortAndLimitWorkflowSummaries([summary, ...current]));
    rememberActive(nextState.id);
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      await putWorkflowRecord({
        id: nextState.id as string,
        createdAt: nextState.createdAt as number,
        updatedAt: nextState.updatedAt as number,
        state: { ...nextState, highlightSearchBox: false, highlightTrigger: 0 },
      }, {
        title: summary.title,
        currentStep: summary.currentStep,
        hasResearch: summary.hasResearch,
        hasScript: summary.hasScript,
        hasThumbnail: summary.hasThumbnail,
      });
      const removed = await pruneWorkflowRecords();
      if (removed.length > 0) setRecentWorkflows((current) => current.filter((item) => !removed.includes(item.id)));
      setHistoryError(null);
    }).catch((error) => {
      console.error("Failed to save workflow history:", error);
      setHistoryError("Der Workflow konnte nicht auf dem Server gespeichert werden.");
    });
  }, [rememberActive]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let summaries = await listWorkflowSummaries();
        if (cancelled) return;

        // Einmalige Übernahme: Workflows aus der alten Browser-Ablage gehören
        // dem Admin, der die App vor dem Login-System benutzt hat. Sie werden
        // nur in ein leeres Admin-Konto übernommen und danach lokal gelöscht.
        if (summaries.length === 0 && user?.role === "admin") {
          const legacy = await readLegacyIndexedDbRecords<WorkflowState>();
          if (legacy.length > 0) {
            for (const record of legacy.sort((left, right) => left.updatedAt - right.updatedAt)) {
              const summary = recordToSummary(record);
              if (!summary) continue;
              const normalized = normalizeState(record.state, record.id);
              await putWorkflowRecord({
                id: normalized.id as string,
                createdAt: normalized.createdAt as number,
                updatedAt: normalized.updatedAt as number,
                state: normalized,
              }, summary);
            }
            await clearLegacyIndexedDb();
            summaries = await listWorkflowSummaries();
            if (cancelled) return;
          }
        }

        const activeId = readActive();
        const selectedSummary = summaries.find((summary) => summary.id === activeId) || summaries[0];
        let selectedRecord = selectedSummary ? await getWorkflowRecord<WorkflowState>(selectedSummary.id) : null;
        if (cancelled) return;
        if (!selectedRecord) {
          const migrated = normalizeState(readLegacyState() || {});
          const summary = summaryFromState(migrated);
          selectedRecord = {
            id: migrated.id as string,
            createdAt: migrated.createdAt as number,
            updatedAt: migrated.updatedAt as number,
            state: migrated,
          };
          if (summary) {
            await putWorkflowRecord(selectedRecord, summary);
            summaries = [summary, ...summaries.filter((item) => item.id !== summary.id)];
          }
          window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
        }
        setState(normalizeState(selectedRecord.state, selectedRecord.id));
        setRecentWorkflows(sortAndLimitWorkflowSummaries(summaries));
        rememberActive(selectedRecord.id);
      } catch (error) {
        console.error("Failed to load workflow history:", error);
        if (!cancelled) {
          const fallback = normalizeState(readLegacyState() || {});
          const summary = summaryFromState(fallback);
          setState(fallback);
          setRecentWorkflows(summary ? [summary] : []);
          setHistoryError("Deine Workflows konnten nicht vom Server geladen werden. Der aktuelle Workflow bleibt für diese Sitzung geöffnet.");
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setHistoryLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // Nur einmal pro angemeldetem Benutzer laden; der Provider wird beim
    // Benutzerwechsel neu eingehängt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (hydrated) queueSave(state);
  }, [hydrated, queueSave, state]);

  const startWorkflow = useCallback(() => {
    const now = Date.now();
    setState((previous) => ({
      ...createEmptyState(createWorkflowId(), now),
      highlightSearchBox: true,
      highlightTrigger: previous.highlightTrigger + 1,
    }));
  }, []);

  const openWorkflow = useCallback(async (id: string): Promise<WorkflowStep | null> => {
    try {
      await saveQueueRef.current;
      const record = await getWorkflowRecord<WorkflowState>(id);
      if (!record) {
        setRecentWorkflows((current) => current.filter((item) => item.id !== id));
        setHistoryError("Dieser Workflow ist nicht mehr verfügbar.");
        return null;
      }
      const restored = normalizeState(record.state, record.id);
      restored.currentStep = restorableStep(restored);
      setState(restored);
      rememberActive(id);
      setHistoryError(null);
      return restored.currentStep;
    } catch (error) {
      console.error("Failed to open workflow:", error);
      setHistoryError("Der ausgewählte Workflow konnte nicht geöffnet werden.");
      return null;
    }
  }, [rememberActive]);

  const renameWorkflow = useCallback(async (id: string, title: string): Promise<boolean> => {
    const customTitle = normalizeCustomWorkflowTitle(title);
    if (!customTitle) {
      setHistoryError("Workflow-Namen dürfen nicht leer sein.");
      return false;
    }
    try {
      await saveQueueRef.current;
      const record = await getWorkflowRecord<WorkflowState>(id);
      if (!record) {
        setRecentWorkflows((current) => current.filter((item) => item.id !== id));
        setHistoryError("Dieser Workflow ist nicht mehr verfügbar.");
        return false;
      }
      const current = normalizeState(record.state, record.id);
      const renamed: WorkflowState = {
        ...current,
        title: customTitle,
        customTitle,
        updatedAt: Date.now(),
      };
      const renamedSummary = summaryFromState(renamed);
      if (!renamedSummary) return false;
      await putWorkflowRecord({
        id: record.id,
        createdAt: record.createdAt,
        updatedAt: renamed.updatedAt as number,
        state: renamed,
      }, renamedSummary);
      setRecentWorkflows(sortAndLimitWorkflowSummaries(await listWorkflowSummaries()));
      if (state.id === id) setState(renamed);
      setHistoryError(null);
      return true;
    } catch (error) {
      console.error("Failed to rename workflow:", error);
      setHistoryError("Der Workflow konnte nicht umbenannt werden.");
      return false;
    }
  }, [state.id]);

  const removeWorkflow = useCallback(async (id: string): Promise<WorkflowStep | null> => {
    try {
      await saveQueueRef.current;
      await deleteWorkflowRecord(id);
      const summaries = await listWorkflowSummaries();
      setRecentWorkflows(sortAndLimitWorkflowSummaries(summaries));
      if (state.id !== id) {
        setHistoryError(null);
        return state.currentStep;
      }
      const next = summaries[0] ? await getWorkflowRecord<WorkflowState>(summaries[0].id) : null;
      if (next) {
        const restored = normalizeState(next.state, next.id);
        restored.currentStep = restorableStep(restored);
        setState(restored);
        rememberActive(restored.id as string);
        setHistoryError(null);
        return restored.currentStep;
      }
      const now = Date.now();
      const fresh = createEmptyState(createWorkflowId(), now);
      setState(fresh);
      rememberActive(fresh.id as string);
      setHistoryError(null);
      return "research";
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      setHistoryError("Der Workflow konnte nicht gelöscht werden.");
      return null;
    }
  }, [rememberActive, state.currentStep, state.id]);

  const clearHighlight = useCallback(() => setState((previous) => ({ ...previous, highlightSearchBox: false })), []);
  const endWorkflow = useCallback(() => setState((previous) => ({ ...previous, isWorkflowActive: false })), []);
  const setCachedResearch = useCallback((data: CachedResearchData) => setState((previous) => updateState(previous, { cachedResearch: data })), []);
  const setIdeaData = useCallback((data: IdeaData) => setState((previous) => updateState(previous, { idea: data })), []);
  const goToStep = useCallback((step: WorkflowStep | "ideas") => setState((previous) => updateState(previous, { currentStep: step === "ideas" ? "research" : step })), []);
  const clearWorkflow = useCallback(() => setState((previous) => {
    const now = Date.now();
    return { ...createEmptyState(previous.id || createWorkflowId(), previous.createdAt || now), updatedAt: now, highlightTrigger: previous.highlightTrigger };
  }), []);
  const clearResearchCache = useCallback(() => setState((previous) => updateState(previous, { currentStep: "research", cachedResearch: null, idea: null })), []);
  const setScriptData = useCallback((data: ScriptData) => setState((previous) => updateState(previous, { cachedScript: data })), []);
  const clearScriptCache = useCallback(() => setState((previous) => updateState(previous, { cachedScript: null })), []);
  const setThumbnailData = useCallback((data: ThumbnailData) => setState((previous) => updateState(previous, { cachedThumbnail: data })), []);

  return (
    <WorkflowContext.Provider value={{
      state, recentWorkflows, historyLoading, historyError, startWorkflow, openWorkflow, renameWorkflow, removeWorkflow,
      endWorkflow, setCachedResearch, setIdeaData, setScriptData, setThumbnailData, clearScriptCache,
      goToStep, clearWorkflow, clearHighlight, clearResearchCache,
    }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) throw new Error("useWorkflow must be used within a WorkflowProvider");
  return context;
}

export type { CachedResearchData, IdeaData, ResearchInsights, ScriptData, ThumbnailData, WorkflowState };
