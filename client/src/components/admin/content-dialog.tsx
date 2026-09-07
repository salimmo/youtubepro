import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { CONTENT_KIND_LABELS, type ContentRecord } from "@shared/auth-contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { formatDateTime, formatNumber, parseApiError } from "./utils";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  return undefined;
}

function stringList(value: unknown): string[] {
  return asArray(value).map(asString).filter((item) => item.length > 0);
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

// Anzeige über das Wörterbuch (admin.contentKind.<kind>); die Konstante aus dem
// Vertrag dient nur zur Prüfung, ob die Art bekannt ist.
function kindLabel(t: Translate, kind: string | null | undefined): string {
  return kind && kind in CONTENT_KIND_LABELS ? t(`admin.contentKind.${kind}`) : kind || t("admin.content.fallbackKind");
}

// ---------- Bausteine ----------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function PreText({ children }: { children: string }) {
  return (
    <pre className="whitespace-pre-wrap rounded-lg border border-border bg-background/50 p-4 font-sans text-sm">
      {children}
    </pre>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  let text = "";
  try {
    text = JSON.stringify(value, null, 2) ?? "";
  } catch {
    text = String(value);
  }
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-background/50 p-4 font-mono text-xs">
      {text}
    </pre>
  );
}

function BulletList({ items }: { items: string[] }) {
  const t = useT();
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{t("admin.content.noEntries")}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((item, index) => <li key={`${index}-${item.slice(0, 20)}`}>{item}</li>)}
    </ul>
  );
}

function MetaRow({ label, value }: { label: string; value: unknown }) {
  const text = asString(value);
  if (!text) return null;
  return (
    <div className="flex flex-wrap gap-x-2 text-sm">
      <span className="font-medium">{label}:</span>
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}

// ---------- Rendering je Kind ----------

function ThumbnailContent({ payload }: { payload: AnyRecord }) {
  const t = useT();
  const image = asString(payload.image);
  const topic = asString(payload.topic);
  const fileName = `thumbnail-${(topic || "youtube").replace(/[^a-z0-9äöüß-]+/gi, "-").toLowerCase()}.png`;
  return (
    <div className="space-y-4">
      {image ? (
        <div className="space-y-3">
          <img
            src={image}
            alt={topic ? t("admin.content.thumbnailAlt", { topic }) : t("admin.content.thumbnailAltGeneric")}
            className="w-full max-w-2xl rounded-lg border border-border"
          />
          <Button asChild variant="outline" size="sm">
            <a href={image} download={fileName}>
              <Download className="mr-2 h-4 w-4" />
              {t("admin.content.downloadImage")}
            </a>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("admin.content.noImage")}</p>
      )}
      <div className="space-y-1">
        <MetaRow label={t("admin.content.topic")} value={payload.topic} />
        <MetaRow label={t("admin.content.mainText")} value={payload.mainText} />
        <MetaRow label={t("admin.content.subText")} value={payload.subText} />
        <MetaRow label={t("admin.content.style")} value={payload.style} />
        <MetaRow label={t("admin.content.model")} value={payload.model} />
      </div>
      {asString(payload.prompt) && (
        <details className="rounded-lg border border-border bg-background/50 p-3">
          <summary className="cursor-pointer text-sm font-medium">{t("admin.content.showPrompt")}</summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted-foreground">{asString(payload.prompt)}</pre>
        </details>
      )}
    </div>
  );
}

function ScriptContent({ payload }: { payload: AnyRecord }) {
  const t = useT();
  const titles = stringList(payload.titles);
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <MetaRow label={t("admin.content.topic")} value={payload.topic} />
        <MetaRow label={t("admin.content.format")} value={payload.format} />
        <MetaRow label={t("admin.content.audience")} value={payload.audience} />
      </div>
      {titles.length > 0 && (
        <Section title={t("admin.content.titleSuggestions")}><BulletList items={titles} /></Section>
      )}
      {asString(payload.hook) && <Section title={t("admin.content.hook")}><PreText>{asString(payload.hook)}</PreText></Section>}
      {asString(payload.script) && <Section title={t("admin.content.script")}><PreText>{asString(payload.script)}</PreText></Section>}
      {asString(payload.payoff) && <Section title={t("admin.content.payoff")}><PreText>{asString(payload.payoff)}</PreText></Section>}
      {asString(payload.primaryCta) && <Section title={t("admin.content.cta")}><PreText>{asString(payload.primaryCta)}</PreText></Section>}
      {payload.studioValidation !== undefined && payload.studioValidation !== null && (
        <Section title={t("admin.content.studioValidation")}>
          {typeof payload.studioValidation === "string"
            ? <PreText>{payload.studioValidation}</PreText>
            : <JsonBlock value={payload.studioValidation} />}
        </Section>
      )}
    </div>
  );
}

function IdeasContent({ payload }: { payload: AnyRecord }) {
  const t = useT();
  const ideas = asArray(payload.ideas).map(asRecord);
  if (ideas.length === 0) return <p className="text-sm text-muted-foreground">{t("admin.content.noIdeas")}</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {ideas.map((idea, index) => {
        const keywords = stringList(idea.keywords);
        return (
          <div key={`${index}-${asString(idea.title).slice(0, 20)}`} className="space-y-2 rounded-lg border border-border bg-background/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h4 className="font-semibold">{asString(idea.title) || t("admin.content.ideaFallback", { index: index + 1 })}</h4>
              <div className="flex flex-wrap gap-1">
                {asString(idea.format) && <Badge variant="outline">{asString(idea.format)}</Badge>}
                {asString(idea.difficulty) && <Badge variant="outline">{asString(idea.difficulty)}</Badge>}
              </div>
            </div>
            {asString(idea.description) && <p className="text-sm text-muted-foreground">{asString(idea.description)}</p>}
            <div className="space-y-1">
              <MetaRow label={t("admin.content.honestPromise")} value={idea.honestPromise} />
              <MetaRow label={t("admin.content.payoff")} value={idea.payoff} />
              <MetaRow label={t("admin.content.thumbnailConcept")} value={idea.thumbnailConcept} />
              <MetaRow label={t("admin.content.studioMetric")} value={idea.studioMetric} />
              <MetaRow label={t("admin.content.experimentRule")} value={idea.experimentRule} />
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {keywords.map((keyword) => <Badge key={keyword} variant="secondary">{keyword}</Badge>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResearchSnapshotContent({ payload }: { payload: AnyRecord }) {
  const t = useT();
  const videos = asArray(payload.videos).map(asRecord);
  const filters = asRecord(payload.filters);
  const filterEntries = Object.entries(filters).filter(([, value]) => asString(value));
  const warnings = stringList(payload.warnings);
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <MetaRow label={t("admin.content.query")} value={payload.query} />
        <MetaRow label={t("admin.content.totalResults")} value={asNumber(payload.totalResults) !== undefined ? formatNumber(asNumber(payload.totalResults)) : ""} />
      </div>
      {filterEntries.length > 0 && (
        <Section title={t("admin.content.filters")}>
          <div className="flex flex-wrap gap-1">
            {filterEntries.map(([key, value]) => (
              <Badge key={key} variant="outline">{key}: {asString(value)}</Badge>
            ))}
          </div>
        </Section>
      )}
      {warnings.length > 0 && (
        <Section title={t("admin.content.warnings")}><BulletList items={warnings} /></Section>
      )}
      <Section title={t("admin.content.videos", { count: videos.length })}>
        {videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.content.noVideos")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.content.col.title")}</TableHead>
                <TableHead>{t("admin.content.col.channel")}</TableHead>
                <TableHead className="text-right">{t("admin.content.col.views")}</TableHead>
                <TableHead>{t("admin.content.col.published")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((video, index) => {
                const url = asString(video.url);
                const title = asString(video.title) || t("admin.content.untitled");
                return (
                  <TableRow key={asString(video.id) || String(index)}>
                    <TableCell className="max-w-md">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <span className="line-clamp-2">{title}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="line-clamp-2">{title}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{asString(video.channelTitle) || "–"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(asNumber(video.viewCount))}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {asString(video.publishedAt) ? formatDateTime(asString(video.publishedAt)) : "–"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>
      {payload.analytics !== undefined && payload.analytics !== null && (
        <details className="rounded-lg border border-border bg-background/50 p-3">
          <summary className="cursor-pointer text-sm font-medium">{t("admin.content.analyticsJson")}</summary>
          <div className="mt-2"><JsonBlock value={payload.analytics} /></div>
        </details>
      )}
    </div>
  );
}

const INSIGHT_KNOWN_KEYS = new Set([
  "summary",
  "evidenceClaims",
  "peopleAlsoAsk",
  "recommendedActions",
]);

const CLAIM_GROUPS: Array<{ key: string; titleKey: string; match: (level: string) => boolean }> = [
  { key: "observed", titleKey: "admin.content.claim.observed", match: (level) => /observ|beobacht/i.test(level) },
  { key: "inferred", titleKey: "admin.content.claim.inferred", match: (level) => /infer|derive|abgeleit/i.test(level) },
  { key: "studio", titleKey: "admin.content.claim.studio", match: (level) => /studio/i.test(level) },
];

function claimText(claim: unknown): string {
  if (typeof claim === "string") return claim;
  const record = asRecord(claim);
  return asString(record.claim) || asString(record.text) || asString(record.statement) || asString(record.title) || asString(claim);
}

function claimLevel(claim: unknown): string {
  const record = asRecord(claim);
  return asString(record.evidenceLevel) || asString(record.level) || asString(record.confidence) || asString(record.type);
}

function ResearchInsightsContent({ payload }: { payload: AnyRecord }) {
  const t = useT();
  const claims = asArray(payload.evidenceClaims);
  const grouped = CLAIM_GROUPS.map((group) => ({
    ...group,
    items: claims.filter((claim) => group.match(claimLevel(claim))).map(claimText).filter(Boolean),
  }));
  const ungrouped = claims
    .filter((claim) => !CLAIM_GROUPS.some((group) => group.match(claimLevel(claim))))
    .map(claimText)
    .filter(Boolean);
  const questions = asArray(payload.peopleAlsoAsk).map((item) => {
    if (typeof item === "string") return item;
    const record = asRecord(item);
    return asString(record.question) || asString(record.text) || asString(item);
  }).filter(Boolean);
  const actions = asArray(payload.recommendedActions).map((item) => {
    if (typeof item === "string") return item;
    const record = asRecord(item);
    const main = asString(record.action) || asString(record.title) || asString(record.text) || asString(item);
    const why = asString(record.reason) || asString(record.rationale) || asString(record.description);
    return why ? `${main} – ${why}` : main;
  }).filter(Boolean);
  const rest = Object.fromEntries(Object.entries(payload).filter(([key]) => !INSIGHT_KNOWN_KEYS.has(key)));

  return (
    <div className="space-y-5">
      {asString(payload.summary) && (
        <Section title={t("admin.content.summary")}><PreText>{asString(payload.summary)}</PreText></Section>
      )}
      {claims.length > 0 && (
        <Section title={t("admin.content.evidence")}>
          <div className="grid gap-4 md:grid-cols-3">
            {grouped.map((group) => (
              <div key={group.key} className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
                <h4 className="text-sm font-semibold">{t(group.titleKey)}</h4>
                <BulletList items={group.items} />
              </div>
            ))}
          </div>
          {ungrouped.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
              <h4 className="text-sm font-semibold">{t("admin.content.moreEvidence")}</h4>
              <BulletList items={ungrouped} />
            </div>
          )}
        </Section>
      )}
      {questions.length > 0 && (
        <Section title={t("admin.content.viewerQuestions")}><BulletList items={questions} /></Section>
      )}
      {actions.length > 0 && (
        <Section title={t("admin.content.recommendedActions")}><BulletList items={actions} /></Section>
      )}
      {Object.keys(rest).length > 0 && (
        <details className="rounded-lg border border-border bg-background/50 p-3">
          <summary className="cursor-pointer text-sm font-medium">{t("admin.content.moreDataJson")}</summary>
          <div className="mt-2"><JsonBlock value={rest} /></div>
        </details>
      )}
    </div>
  );
}

function BeforeAfterContent({ payload }: { payload: AnyRecord }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <MetaRow label={t("admin.content.section")} value={payload.sectionName} />
      <div className="grid gap-4 md:grid-cols-2">
        <Section title={t("admin.content.before")}>
          <PreText>{asString(payload.before) || "–"}</PreText>
        </Section>
        <Section title={t("admin.content.after")}>
          <PreText>{asString(payload.after) || "–"}</PreText>
        </Section>
      </div>
    </div>
  );
}

function TitleListContent({ payload, listKey, title }: { payload: AnyRecord; listKey: string; title: string }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <MetaRow label={t("admin.content.topic")} value={payload.topic} />
      <Section title={title}><BulletList items={stringList(payload[listKey])} /></Section>
    </div>
  );
}

function ContentBody({ content }: { content: ContentRecord }) {
  const t = useT();
  const payload = asRecord(content.payload);
  switch (content.kind) {
    case "thumbnail":
      return <ThumbnailContent payload={payload} />;
    case "script":
      return <ScriptContent payload={payload} />;
    case "ideas":
      return <IdeasContent payload={payload} />;
    case "research_snapshot":
      return <ResearchSnapshotContent payload={payload} />;
    case "research_insights":
      return <ResearchInsightsContent payload={payload} />;
    case "script_section":
    case "script_paragraph":
      return <BeforeAfterContent payload={payload} />;
    case "script_titles":
      return <TitleListContent payload={payload} listKey="titles" title={t("admin.content.titleSuggestions")} />;
    case "thumbnail_suggestions":
      return <TitleListContent payload={payload} listKey="suggestions" title={t("admin.content.textSuggestions")} />;
    case "narration":
      return asString(payload.narration)
        ? <PreText>{asString(payload.narration)}</PreText>
        : <JsonBlock value={content.payload} />;
    default:
      return <JsonBlock value={content.payload} />;
  }
}

// ---------- Dialog ----------

interface ContentDialogProps {
  contentId: number | null;
  onClose: () => void;
}

export function ContentDialog({ contentId, onClose }: ContentDialogProps) {
  const t = useT();
  const { data, isLoading, isError, error } = useQuery<{ content: ContentRecord }>({
    queryKey: ["/api/admin/contents", contentId],
    queryFn: async () => apiRequest("GET", `/api/admin/contents/${contentId}`) as Promise<{ content: ContentRecord }>,
    enabled: contentId !== null,
  });
  const content = data?.content;

  return (
    <Dialog open={contentId !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="pr-6">{content?.title || t("admin.content.dialogTitle")}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {content && <Badge variant="outline">{kindLabel(t, content.kind)}</Badge>}
              {content?.username && <span>{t("admin.content.user", { username: content.username })}</span>}
              {content?.createdAt && <span>{formatDateTime(content.createdAt)}</span>}
            </div>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t("admin.content.loading")}
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTitle>{t("admin.content.errorTitle")}</AlertTitle>
            <AlertDescription>{parseApiError(error).message}</AlertDescription>
          </Alert>
        ) : content ? (
          <div className="pt-2">
            <ContentBody content={content} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
