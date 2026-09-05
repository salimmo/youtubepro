import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Eye, FileText, Image as ImageIcon, Loader2, RefreshCw, Search } from "lucide-react";
import type {
  AdminUser,
  AdminWorkflowDetailResponse,
  AdminWorkflowListResponse,
  AdminWorkflowSummary,
  WorkflowStepName,
} from "@shared/auth-contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DIFFICULTY_LABELS, IDEA_FORMAT_LABELS, labelFor } from "@/lib/labels";
import { apiRequest } from "@/lib/queryClient";
import { formatDateTime, formatNumber, formatRelative, parseApiError, truncate, userLabel } from "./utils";

const ALL = "all";
const LIST_LIMIT = 200;

// ---------- Lokale, bewusst optionale Typen für den gespeicherten Client-Zustand ----------
// Der Server liefert `state` als unknown; alle Felder können fehlen oder null sein.

interface StoredVideo {
  id?: string;
  title?: string;
  channelTitle?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  duration?: string;
}

interface StoredInsights {
  peopleAlsoAsk?: Array<{ question?: string; answer?: string }>;
  targetAudience?: {
    primaryDemographic?: string;
    ageRange?: string;
    interests?: string[];
    painPoints?: string[];
  };
  nicheAnalysis?: {
    competitionLevel?: string;
    growthTrend?: string;
    recommendedFormats?: string[];
    monetizationPotential?: string;
  };
  contentGaps?: string[];
  trendingSubtopics?: string[];
}

interface StoredResearch {
  query?: string;
  totalResults?: number;
  filters?: { uploadDate?: string; duration?: string; sortBy?: string };
  videos?: StoredVideo[];
  insights?: StoredInsights | null;
  timestamp?: number;
}

interface StoredIdea {
  title?: string;
  description?: string;
  keywords?: string[];
  format?: string;
  difficulty?: string;
  honestPromise?: string;
  payoff?: string;
  thumbnailConcept?: string;
}

interface StoredIdeaState {
  selectedIdea?: StoredIdea | null;
  generatedIdeas?: StoredIdea[];
  niche?: string;
  audience?: string;
}

interface StoredScript {
  script?: string;
  topic?: string;
  title?: string;
  format?: string;
  audience?: string;
  wordCount?: number;
  estimatedDuration?: string;
  timestamp?: number;
  result?: { titles?: string[]; hook?: string; payoff?: string; primaryCta?: string };
}

interface StoredThumbnail {
  topic?: string;
  mainText?: string;
  subText?: string;
  thumbnailStyle?: string;
  thumbnailData?: string | null;
  resultModel?: string | null;
  timestamp?: number;
}

interface StoredWorkflowState {
  title?: string;
  currentStep?: WorkflowStepName;
  createdAt?: number;
  updatedAt?: number;
  cachedResearch?: StoredResearch | null;
  idea?: StoredIdeaState | null;
  cachedScript?: StoredScript | null;
  cachedThumbnail?: StoredThumbnail | null;
}

function asState(value: unknown): StoredWorkflowState {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as StoredWorkflowState) : {};
}

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function textList(value: unknown): string[] {
  return asList<unknown>(value).filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// ---------- Formatierung ----------

const STEP_LABELS: Record<WorkflowStepName, string> = {
  research: "Recherche",
  script: "Skript",
  thumbnail: "Thumbnail",
};

const UPLOAD_DATE_LABELS: Record<string, string> = {
  any: "Beliebig",
  hour: "Letzte Stunde",
  today: "Heute",
  week: "Diese Woche",
  month: "Dieser Monat",
  year: "Dieses Jahr",
};

const DURATION_LABELS: Record<string, string> = {
  any: "Beliebig",
  short: "Kurz",
  medium: "Mittel",
  long: "Lang",
};

const SORT_LABELS: Record<string, string> = {
  relevance: "Relevanz",
  date: "Datum",
  viewCount: "Aufrufe",
  rating: "Bewertung",
};

function stepLabel(step: string | null | undefined): string {
  return step && step in STEP_LABELS ? STEP_LABELS[step as WorkflowStepName] : step || "–";
}

// Zeitstempel im Workflow sind Millisekunden; die Helfer aus utils erwarten Strings.
function msToIso(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildListUrl(userId: string, includeDeleted: boolean): string {
  const params = new URLSearchParams();
  if (userId !== ALL) params.set("userId", userId);
  if (includeDeleted) params.set("includeDeleted", "true");
  params.set("limit", String(LIST_LIMIT));
  return `/api/admin/workflows?${params.toString()}`;
}

// ---------- Bausteine ----------

function StepBadge({ step }: { step: string | null | undefined }) {
  return (
    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
      {stepLabel(step)}
    </Badge>
  );
}

function ContentBadges({ workflow }: { workflow: AdminWorkflowSummary }) {
  const items: Array<{ key: string; label: string; short: string; present: boolean; Icon: typeof Search }> = [
    { key: "r", label: "Recherche", short: "R", present: Boolean(workflow.hasResearch), Icon: Search },
    { key: "s", label: "Skript", short: "S", present: Boolean(workflow.hasScript), Icon: FileText },
    { key: "t", label: "Thumbnail", short: "T", present: Boolean(workflow.hasThumbnail), Icon: ImageIcon },
  ];
  return (
    <div className="flex items-center gap-1">
      {items.map(({ key, label, short, present, Icon }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              aria-label={`${label}: ${present ? "vorhanden" : "nicht vorhanden"}`}
              className={present
                ? "gap-1 border-green-500/40 bg-green-500/10 px-1.5 text-green-500"
                : "gap-1 px-1.5 text-muted-foreground/50"}
            >
              <Icon className="h-3 w-3" />
              {short}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{label} {present ? "vorhanden" : "nicht vorhanden"}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value && value.trim() !== "" ? value : "–"}</p>
    </div>
  );
}

function BadgeList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">–</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <Badge key={`${item}-${index}`} variant="secondary">{item}</Badge>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">–</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
    </ul>
  );
}

function PreText({ children }: { children: string }) {
  return (
    <pre className="whitespace-pre-wrap rounded-lg border border-border bg-background/50 p-4 font-sans text-sm">
      {children}
    </pre>
  );
}

function EmptyHint({ children = "Nicht vorhanden." }: { children?: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

// ---------- Detail: Recherche ----------

function ResearchPanel({ research }: { research: StoredResearch }) {
  const videos = asList<StoredVideo>(research.videos);
  const filters = research.filters ?? {};
  const insights = research.insights && typeof research.insights === "object" ? research.insights : null;
  const audience = insights?.targetAudience;
  const niche = insights?.nicheAnalysis;
  const questions = asList<{ question?: string; answer?: string }>(insights?.peopleAlsoAsk);

  return (
    <div className="space-y-6">
      <Section title="Suche">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Suchbegriff" value={text(research.query)} />
          <Field label="Gesamttreffer" value={formatNumber(research.totalResults)} />
          <Field label="Durchgeführt am" value={formatDateTime(msToIso(research.timestamp))} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.uploadDate && (
            <Badge variant="outline">Zeitraum: {labelFor(UPLOAD_DATE_LABELS, filters.uploadDate)}</Badge>
          )}
          {filters.duration && (
            <Badge variant="outline">Dauer: {labelFor(DURATION_LABELS, filters.duration)}</Badge>
          )}
          {filters.sortBy && (
            <Badge variant="outline">Sortierung: {labelFor(SORT_LABELS, filters.sortBy)}</Badge>
          )}
        </div>
      </Section>

      <Section title={`Videos (${formatNumber(videos.length)})`}>
        {videos.length === 0 ? (
          <EmptyHint>Keine Videos gespeichert.</EmptyHint>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Vorschau</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead className="text-right">Aufrufe</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Kommentare</TableHead>
                  <TableHead>Veröffentlicht</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((video, index) => {
                  const id = text(video.id);
                  const title = text(video.title) || "Ohne Titel";
                  return (
                    <TableRow key={id || index}>
                      <TableCell>
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            className="h-12 w-20 rounded object-cover"
                          />
                        ) : (
                          <div className="h-12 w-20 rounded bg-muted" />
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {id ? (
                          <a
                            href={`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-start gap-1 font-medium hover:underline"
                          >
                            <span className="line-clamp-2">{title}</span>
                            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </a>
                        ) : (
                          <span className="line-clamp-2 font-medium">{title}</span>
                        )}
                        {video.duration && (
                          <span className="block text-xs text-muted-foreground">{video.duration}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {text(video.channelTitle) || "–"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(video.viewCount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(video.likeCount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(video.commentCount)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(video.publishedAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {insights && (
        <>
          {questions.length > 0 && (
            <Section title="Zuschauerfragen">
              <div className="space-y-2">
                {questions.map((item, index) => (
                  <div key={index} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{text(item.question) || "–"}</p>
                    {item.answer && <p className="mt-1 text-sm text-muted-foreground">{item.answer}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {audience && (
            <Section title="Zielgruppe">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Primäre Zielgruppe" value={text(audience.primaryDemographic)} />
                <Field label="Altersspanne" value={text(audience.ageRange)} />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Interessen</p>
                  <BadgeList items={textList(audience.interests)} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Schmerzpunkte</p>
                  <BulletList items={textList(audience.painPoints)} />
                </div>
              </div>
            </Section>
          )}

          {niche && (
            <Section title="Nischenanalyse">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Wettbewerb" value={text(niche.competitionLevel)} />
                <Field label="Wachstumstrend" value={text(niche.growthTrend)} />
                <Field label="Monetarisierungspotenzial" value={text(niche.monetizationPotential)} />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Empfohlene Formate</p>
                  <BadgeList items={textList(niche.recommendedFormats)} />
                </div>
              </div>
            </Section>
          )}

          {textList(insights.contentGaps).length > 0 && (
            <Section title="Content-Lücken">
              <BulletList items={textList(insights.contentGaps)} />
            </Section>
          )}

          {textList(insights.trendingSubtopics).length > 0 && (
            <Section title="Unterthemen">
              <BadgeList items={textList(insights.trendingSubtopics)} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Detail: Idee ----------

function IdeaCard({ idea, compact = false }: { idea: StoredIdea; compact?: boolean }) {
  const format = labelFor(IDEA_FORMAT_LABELS, text(idea.format));
  const difficulty = labelFor(DIFFICULTY_LABELS, text(idea.difficulty));
  return (
    <div className={compact ? "rounded-lg border border-border p-3" : "rounded-lg border border-primary/40 bg-primary/5 p-4"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className={compact ? "text-sm font-medium" : "text-base font-semibold"}>{text(idea.title) || "Ohne Titel"}</p>
        <div className="flex flex-wrap gap-1.5">
          {format && <Badge variant="outline">{format}</Badge>}
          {difficulty && <Badge variant="outline">{difficulty}</Badge>}
        </div>
      </div>
      {idea.description && (
        <p className={compact ? "mt-1 text-sm text-muted-foreground" : "mt-2 text-sm"}>{idea.description}</p>
      )}
      {!compact && (
        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Keywords</p>
            <BadgeList items={textList(idea.keywords)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Ehrliches Versprechen" value={text(idea.honestPromise)} />
            <Field label="Payoff" value={text(idea.payoff)} />
            <Field label="Thumbnail-Konzept" value={text(idea.thumbnailConcept)} />
          </div>
        </div>
      )}
    </div>
  );
}

function IdeaPanel({ idea }: { idea: StoredIdeaState }) {
  const selected = idea.selectedIdea && typeof idea.selectedIdea === "object" ? idea.selectedIdea : null;
  const generated = asList<StoredIdea>(idea.generatedIdeas).filter((item) => item && typeof item === "object");
  const others = selected
    ? generated.filter((item) => item !== selected && (item.title !== selected.title || item.description !== selected.description))
    : generated;

  return (
    <div className="space-y-6">
      {(idea.niche || idea.audience) && (
        <Section title="Kontext">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nische" value={text(idea.niche)} />
            <Field label="Zielgruppe" value={text(idea.audience)} />
          </div>
        </Section>
      )}

      <Section title="Ausgewählte Idee">
        {selected ? <IdeaCard idea={selected} /> : <EmptyHint>Keine Idee ausgewählt.</EmptyHint>}
      </Section>

      {others.length > 0 && (
        <Section title={`Weitere generierte Ideen (${formatNumber(others.length)})`}>
          <div className="space-y-2">
            {others.map((item, index) => <IdeaCard key={`${text(item.title)}-${index}`} idea={item} compact />)}
          </div>
        </Section>
      )}
    </div>
  );
}

// ---------- Detail: Skript ----------

function ScriptPanel({ script }: { script: StoredScript }) {
  const result = script.result && typeof script.result === "object" ? script.result : {};
  const titles = textList(result.titles);
  const body = text(script.script);

  return (
    <div className="space-y-6">
      <Section title="Eckdaten">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Thema" value={text(script.topic)} />
          <Field label="Format" value={labelFor(IDEA_FORMAT_LABELS, text(script.format))} />
          <Field label="Zielgruppe" value={text(script.audience)} />
          <Field label="Wörter" value={formatNumber(script.wordCount)} />
          <Field label="Geschätzte Dauer" value={text(script.estimatedDuration)} />
          <Field label="Erstellt am" value={formatDateTime(msToIso(script.timestamp))} />
        </div>
      </Section>

      {(titles.length > 0 || script.title) && (
        <Section title="Titelvorschläge">
          <BulletList items={titles.length > 0 ? titles : [text(script.title)]} />
        </Section>
      )}

      {result.hook && (
        <Section title="Hook">
          <p className="text-sm">{result.hook}</p>
        </Section>
      )}

      <Section title="Skript">
        {body ? <PreText>{body}</PreText> : <EmptyHint>Kein Skripttext gespeichert.</EmptyHint>}
      </Section>

      {(result.payoff || result.primaryCta) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {result.payoff && (
            <Section title="Payoff">
              <p className="text-sm">{result.payoff}</p>
            </Section>
          )}
          {result.primaryCta && (
            <Section title="Call-to-Action">
              <p className="text-sm">{result.primaryCta}</p>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Detail: Thumbnail ----------

function ThumbnailPanel({ thumbnail, fileBase }: { thumbnail: StoredThumbnail; fileBase: string }) {
  const data = text(thumbnail.thumbnailData);
  const hasImage = data.startsWith("data:image/");
  const fileName = `${fileBase || "thumbnail"}.png`;

  return (
    <div className="space-y-6">
      <Section title="Bild">
        {hasImage ? (
          <div className="space-y-3">
            <img
              src={data}
              alt={text(thumbnail.mainText) || "Thumbnail"}
              className="w-full max-w-2xl rounded-lg border border-border"
            />
            <Button asChild variant="outline" size="sm">
              <a href={data} download={fileName} data-testid="link-workflow-thumbnail-download">
                <Download className="mr-2 h-4 w-4" />
                Herunterladen
              </a>
            </Button>
          </div>
        ) : (
          <EmptyHint>Kein Bild gespeichert.</EmptyHint>
        )}
      </Section>

      <Section title="Einstellungen">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Thema" value={text(thumbnail.topic)} />
          <Field label="Haupttext" value={text(thumbnail.mainText)} />
          <Field label="Untertext" value={text(thumbnail.subText)} />
          <Field label="Stil" value={text(thumbnail.thumbnailStyle)} />
          <Field label="Modell" value={text(thumbnail.resultModel)} />
          <Field label="Erstellt am" value={formatDateTime(msToIso(thumbnail.timestamp))} />
        </div>
      </Section>
    </div>
  );
}

// ---------- Detail-Dialog ----------

function WorkflowDetailDialog({ workflowId, onClose }: { workflowId: string | null; onClose: () => void }) {
  const open = workflowId !== null;
  const query = useQuery<AdminWorkflowDetailResponse>({
    queryKey: ["/api/admin/workflows", workflowId],
    queryFn: async () =>
      apiRequest("GET", `/api/admin/workflows/${encodeURIComponent(workflowId ?? "")}`) as Promise<AdminWorkflowDetailResponse>,
    enabled: open,
  });

  const workflow = query.data?.workflow;
  const state = asState(query.data?.state);
  const research = state.cachedResearch && typeof state.cachedResearch === "object" ? state.cachedResearch : null;
  const idea = state.idea && typeof state.idea === "object" ? state.idea : null;
  const script = state.cachedScript && typeof state.cachedScript === "object" ? state.cachedScript : null;
  const thumbnail = state.cachedThumbnail && typeof state.cachedThumbnail === "object" ? state.cachedThumbnail : null;

  const availability: Record<string, boolean> = {
    research: Boolean(research),
    idea: Boolean(idea && (idea.selectedIdea || asList(idea.generatedIdeas).length > 0)),
    script: Boolean(script),
    thumbnail: Boolean(thumbnail),
  };
  const defaultTab =
    (state.currentStep && availability[state.currentStep] ? state.currentStep : null)
    ?? (["research", "idea", "script", "thumbnail"] as const).find((key) => availability[key])
    ?? "research";

  const title = workflow?.title || state.title || "Workflow";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {title}
            {workflow && <StepBadge step={workflow.currentStep} />}
            {workflow?.deletedAt && (
              <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                Gelöscht
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {workflow
              ? `${userLabel(workflow.displayName, workflow.username)} · angelegt ${formatDateTime(msToIso(workflow.createdAt))} · aktualisiert ${formatDateTime(msToIso(workflow.updatedAt))}${workflow.deletedAt ? ` · gelöscht ${formatDateTime(workflow.deletedAt)}` : ""}`
              : "Gespeicherter Workflow-Zustand eines Benutzers."}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="flex min-h-48 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Workflow wird geladen …
          </div>
        ) : query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Workflow nicht verfügbar</AlertTitle>
            <AlertDescription>{parseApiError(query.error).message}</AlertDescription>
          </Alert>
        ) : (
          <Tabs key={workflowId ?? "none"} defaultValue={defaultTab} className="space-y-4">
            <TabsList className="flex w-full flex-wrap justify-start">
              <TabsTrigger value="research" disabled={!availability.research}>Recherche</TabsTrigger>
              <TabsTrigger value="idea" disabled={!availability.idea}>Idee</TabsTrigger>
              <TabsTrigger value="script" disabled={!availability.script}>Skript</TabsTrigger>
              <TabsTrigger value="thumbnail" disabled={!availability.thumbnail}>Thumbnail</TabsTrigger>
            </TabsList>
            <TabsContent value="research">
              {research ? <ResearchPanel research={research} /> : <EmptyHint />}
            </TabsContent>
            <TabsContent value="idea">
              {idea ? <IdeaPanel idea={idea} /> : <EmptyHint />}
            </TabsContent>
            <TabsContent value="script">
              {script ? <ScriptPanel script={script} /> : <EmptyHint />}
            </TabsContent>
            <TabsContent value="thumbnail">
              {thumbnail
                ? <ThumbnailPanel thumbnail={thumbnail} fileBase={`thumbnail-${workflow?.id ?? workflowId ?? ""}`} />
                : <EmptyHint />}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Tab ----------

export function WorkflowsTab() {
  const [userId, setUserId] = useState<string>(ALL);
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const usersQuery = useQuery<{ users: AdminUser[] }>({ queryKey: ["/api/admin/users"] });
  const users = usersQuery.data?.users ?? [];

  const listQuery = useQuery<AdminWorkflowListResponse>({
    queryKey: ["/api/admin/workflows", { userId, includeDeleted }],
    queryFn: async () =>
      apiRequest("GET", buildListUrl(userId, includeDeleted)) as Promise<AdminWorkflowListResponse>,
  });
  const workflows = listQuery.data?.workflows ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Workflows</CardTitle>
            <CardDescription>
              Gespeicherte Workflows aller Benutzer, neueste zuerst. Auch vom Benutzer gelöschte Workflows bleiben hier sichtbar.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => listQuery.refetch()}
            disabled={listQuery.isFetching}
            data-testid="button-workflows-refresh"
          >
            {listQuery.isFetching
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-2 h-4 w-4" />}
            Aktualisieren
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="workflows-filter-user">Benutzer</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="workflows-filter-user" data-testid="select-workflows-user">
                  <SelectValue placeholder="Alle Benutzer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Alle Benutzer</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {userLabel(user.displayName, user.username)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflows-include-deleted">Gelöschte anzeigen</Label>
              <div className="flex h-10 items-center gap-3">
                <Switch
                  id="workflows-include-deleted"
                  checked={includeDeleted}
                  onCheckedChange={setIncludeDeleted}
                  data-testid="switch-workflows-include-deleted"
                />
                <span className="text-sm text-muted-foreground">
                  {includeDeleted ? "Gelöschte Workflows werden angezeigt" : "Nur aktive Workflows"}
                </span>
              </div>
            </div>
          </div>

          {listQuery.isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Workflows werden geladen …
            </div>
          ) : listQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Workflows nicht verfügbar</AlertTitle>
              <AlertDescription>{parseApiError(listQuery.error).message}</AlertDescription>
            </Alert>
          ) : workflows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Noch keine Workflows.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titel</TableHead>
                  <TableHead>Benutzer</TableHead>
                  <TableHead>Suchbegriff</TableHead>
                  <TableHead>Schritt</TableHead>
                  <TableHead>Inhalt</TableHead>
                  <TableHead>Aktualisiert</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28"><span className="sr-only">Aktionen</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => {
                  const updatedIso = msToIso(workflow.updatedAt);
                  return (
                    <TableRow
                      key={workflow.id}
                      className={workflow.deletedAt ? "opacity-70" : undefined}
                      data-testid={`row-workflow-${workflow.id}`}
                    >
                      <TableCell className="max-w-xs font-medium" title={workflow.title || undefined}>
                        {truncate(workflow.title, 60) || "Ohne Titel"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {workflow.displayName || workflow.username || "–"}
                        {workflow.username && (
                          <span className="block text-xs text-muted-foreground">@{workflow.username}</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs text-muted-foreground" title={workflow.researchQuery || undefined}>
                        {workflow.researchQuery ? (
                          <>
                            {truncate(workflow.researchQuery, 50)}
                            <span className="block text-xs">
                              {formatNumber(workflow.videoCount)} {workflow.videoCount === 1 ? "Video" : "Videos"}
                            </span>
                          </>
                        ) : "–"}
                      </TableCell>
                      <TableCell><StepBadge step={workflow.currentStep} /></TableCell>
                      <TableCell><ContentBadges workflow={workflow} /></TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">{formatRelative(updatedIso)}</span>
                          </TooltipTrigger>
                          <TooltipContent>{formatDateTime(updatedIso)}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {workflow.deletedAt ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="cursor-default border-destructive/40 bg-destructive/10 text-destructive"
                              >
                                Gelöscht
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Gelöscht am {formatDateTime(workflow.deletedAt)}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Badge variant="outline" className="border-green-500/40 bg-green-500/10 text-green-500">
                            Aktiv
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedId(workflow.id)}
                          data-testid={`button-view-workflow-${workflow.id}`}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ansehen
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <WorkflowDetailDialog workflowId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
