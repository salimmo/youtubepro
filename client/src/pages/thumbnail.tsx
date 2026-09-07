import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle, CheckCircle2, ChevronDown, Download, Image as ImageIcon, ImagePlus,
  Info, Loader2, RefreshCw, Settings, SlidersHorizontal, Sparkles, Trash2, Wand2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useWorkflow } from "@/lib/workflow-context";
import { getActiveLanguage, translate, useT } from "@/lib/i18n";

const MAX_INPUT_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_GENERATION_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REFERENCE_IMAGES = 3;

// Zweiter Eintrag ist jeweils der Übersetzungsschlüssel des Labels.
const thumbnailStyles = [
  ["bold", "thumbnail.style.bold"], ["minimal", "thumbnail.style.minimal"], ["gaming", "thumbnail.style.gaming"],
  ["vlog", "thumbnail.style.vlog"], ["tutorial", "thumbnail.style.tutorial"], ["cinematic", "thumbnail.style.cinematic"],
  ["tech", "thumbnail.style.tech"], ["lifestyle", "thumbnail.style.lifestyle"],
] as const;
const compositionOptions = [
  ["centered", "thumbnail.composition.centered"], ["rule-of-thirds", "thumbnail.composition.ruleOfThirds"], ["close-up", "thumbnail.composition.closeUp"],
  ["wide-shot", "thumbnail.composition.wideShot"], ["split-screen", "thumbnail.composition.splitScreen"], ["diagonal", "thumbnail.composition.diagonal"],
] as const;
const cameraAngleOptions = [
  ["eye-level", "thumbnail.camera.eyeLevel"], ["low-angle", "thumbnail.camera.lowAngle"], ["high-angle", "thumbnail.camera.highAngle"],
  ["dutch-angle", "thumbnail.camera.dutchAngle"], ["overhead", "thumbnail.camera.overhead"], ["three-quarter", "thumbnail.camera.threeQuarter"],
] as const;
const lightingOptions = [
  ["natural", "thumbnail.lighting.natural"], ["dramatic", "thumbnail.lighting.dramatic"], ["golden-hour", "thumbnail.lighting.goldenHour"],
  ["studio", "thumbnail.lighting.studio"], ["neon", "thumbnail.lighting.neon"], ["backlit", "thumbnail.lighting.backlit"], ["soft", "thumbnail.lighting.soft"],
] as const;
const colorSchemeOptions = [
  ["vibrant", "thumbnail.color.vibrant"], ["muted", "thumbnail.color.muted"], ["warm", "thumbnail.color.warm"],
  ["cool", "thumbnail.color.cool"], ["monochrome", "thumbnail.color.monochrome"], ["complementary", "thumbnail.color.complementary"],
  ["brand-colors", "thumbnail.color.brandColors"],
] as const;
const textPositionOptions = [
  ["left", "thumbnail.textPosition.left"], ["right", "thumbnail.textPosition.right"], ["center", "thumbnail.textPosition.center"], ["top", "thumbnail.textPosition.top"],
  ["bottom", "thumbnail.textPosition.bottom"], ["none", "thumbnail.textPosition.none"],
] as const;
const imageRoleOptions = [
  ["subject", "thumbnail.role.subject"], ["style", "thumbnail.role.style"],
  ["background", "thumbnail.role.background"], ["composition", "thumbnail.role.composition"],
] as const;

type ThumbnailStyle = (typeof thumbnailStyles)[number][0];
type ThumbnailComposition = (typeof compositionOptions)[number][0];
type ThumbnailCameraAngle = (typeof cameraAngleOptions)[number][0];
type ThumbnailLighting = (typeof lightingOptions)[number][0];
type ThumbnailColorScheme = (typeof colorSchemeOptions)[number][0];
type ThumbnailTextPosition = (typeof textPositionOptions)[number][0];
type ReferenceRole = (typeof imageRoleOptions)[number][0];
type ReferenceImage = { image: string; role: ReferenceRole; name: string };
type RequestFailure = { error: string; code: string; category: string; retryable: boolean; suggestion: string; detail?: string };
type ImageModelStatus = { id: string; label: string; description: string };
type SelectOption = readonly [string, string];
type OutcomePreset = {
  id: string; label: string; mainText: string; description: string; style: ThumbnailStyle;
  composition: ThumbnailComposition; cameraAngle: ThumbnailCameraAngle; lighting: ThumbnailLighting;
  colorScheme: ThumbnailColorScheme; textPosition: ThumbnailTextPosition;
};

// label, mainText und description sind Übersetzungsschlüssel.
const outcomePresets: OutcomePreset[] = [
  { id: "tutorial", label: "thumbnail.preset.tutorial.label", mainText: "thumbnail.preset.tutorial.mainText", description: "thumbnail.preset.tutorial.description", style: "tutorial", composition: "rule-of-thirds", cameraAngle: "three-quarter", lighting: "studio", colorScheme: "complementary", textPosition: "right" },
  { id: "comparison", label: "thumbnail.preset.comparison.label", mainText: "thumbnail.preset.comparison.mainText", description: "thumbnail.preset.comparison.description", style: "minimal", composition: "split-screen", cameraAngle: "eye-level", lighting: "studio", colorScheme: "complementary", textPosition: "top" },
  { id: "result", label: "thumbnail.preset.result.label", mainText: "thumbnail.preset.result.mainText", description: "thumbnail.preset.result.description", style: "bold", composition: "close-up", cameraAngle: "eye-level", lighting: "dramatic", colorScheme: "vibrant", textPosition: "left" },
  { id: "case-study", label: "thumbnail.preset.caseStudy.label", mainText: "thumbnail.preset.caseStudy.mainText", description: "thumbnail.preset.caseStudy.description", style: "minimal", composition: "rule-of-thirds", cameraAngle: "eye-level", lighting: "natural", colorScheme: "muted", textPosition: "right" },
  { id: "news", label: "thumbnail.preset.news.label", mainText: "thumbnail.preset.news.mainText", description: "thumbnail.preset.news.description", style: "tech", composition: "wide-shot", cameraAngle: "eye-level", lighting: "studio", colorScheme: "cool", textPosition: "left" },
  { id: "list", label: "thumbnail.preset.list.label", mainText: "thumbnail.preset.list.mainText", description: "thumbnail.preset.list.description", style: "bold", composition: "diagonal", cameraAngle: "high-angle", lighting: "dramatic", colorScheme: "complementary", textPosition: "left" },
  { id: "review", label: "thumbnail.preset.review.label", mainText: "thumbnail.preset.review.mainText", description: "thumbnail.preset.review.description", style: "tech", composition: "centered", cameraAngle: "three-quarter", lighting: "studio", colorScheme: "cool", textPosition: "right" },
];

// Für Helfer außerhalb von React-Komponenten.
const tr = (key: string, vars?: Record<string, string | number>) => translate(getActiveLanguage(), key, vars);

function localFailure(error: string, suggestion: string): RequestFailure {
  return { error, code: "THUMBNAIL_CLIENT_VALIDATION", category: "invalid_response", retryable: false, suggestion };
}

async function readFailure(response: Response): Promise<RequestFailure> {
  let body: Partial<RequestFailure> = {};
  try {
    const text = await response.text();
    if (/^\s*(<!doctype html|<html|<head|<body)/i.test(text)) {
      const title = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(text)?.[1]?.trim();
      body = {
        error: tr("thumbnail.error.serverUnreachable", { status: response.status }),
        suggestion: tr("thumbnail.error.htmlResponseSuggestion"),
        detail: title ? tr("thumbnail.error.pageTitle", { title }) : tr("thumbnail.error.htmlWithoutTitle"),
        category: "provider_server",
        retryable: true,
      };
    } else {
      body = JSON.parse(text);
    }
  } catch { body = {}; }
  return {
    error: body.error || tr("thumbnail.error.requestFailed", { status: response.status }),
    code: body.code || `HTTP_${response.status}`,
    category: body.category || (response.status === 429 ? "quota" : "unknown"),
    retryable: body.retryable ?? response.status >= 429,
    suggestion: body.suggestion || tr("thumbnail.error.genericSuggestion"),
    detail: typeof body.detail === "string" ? body.detail : undefined,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(tr("thumbnail.error.fileRead")));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(tr("thumbnail.error.imageDecode")));
    image.src = dataUrl;
  });
}

async function prepareReferenceImage(file: File): Promise<string> {
  if (file.type !== "image/png" && file.type !== "image/jpeg") throw new Error(tr("thumbnail.error.imageType"));
  if (file.size > MAX_INPUT_IMAGE_BYTES) throw new Error(tr("thumbnail.error.imageTooLarge"));
  const original = await readFileAsDataUrl(file);
  const image = await loadImage(original);
  if (image.naturalWidth < 128 || image.naturalHeight < 128 || image.naturalWidth > 4096 || image.naturalHeight > 4096) {
    throw new Error(tr("thumbnail.error.imageDimensions"));
  }
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error(tr("thumbnail.error.canvasUnavailable"));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const prepared = canvas.toDataURL("image/jpeg", 0.86);
  const approximateBytes = Math.ceil((prepared.length - prepared.indexOf(",") - 1) * 0.75);
  if (approximateBytes > MAX_GENERATION_IMAGE_BYTES) throw new Error(tr("thumbnail.error.preparedTooLarge"));
  return prepared;
}

function FailurePanel({ failure, busy, onRetry, onSettings }: { failure: RequestFailure; busy: boolean; onRetry: () => void; onSettings: () => void }) {
  const t = useT();
  const needsSettings = failure.category === "missing_key" || failure.category === "invalid_key";
  return (
    <Alert variant="destructive" data-testid="thumbnail-error">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{failure.error}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{failure.suggestion}</p>
        {failure.detail && <p className="text-xs opacity-80">{t("common.providerMessage")}: {failure.detail}</p>}
        <div className="flex flex-wrap gap-2">
          {failure.retryable && <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />{t("common.retry")}</Button>}
          {needsSettings && <Button type="button" size="sm" variant="outline" onClick={onSettings}><Settings className="mr-2 h-4 w-4" />{t("thumbnail.error.openSettings")}</Button>}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function LabeledSelect({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: ReadonlyArray<SelectOption>; onChange: (value: string) => void }) {
  const t = useT();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([optionValue, optionLabelKey]) => <SelectItem key={optionValue} value={optionValue}>{t(optionLabelKey)}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

export default function ThumbnailPage() {
  const t = useT();
  const { state: workflowState, setThumbnailData: cacheThumbnailData } = useWorkflow();
  const [, setLocation] = useLocation();
  const lastGenerationMode = useRef<"create" | "variation">("create");
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const selectedIdea = workflowState.idea?.selectedIdea;
  const [topic, setTopic] = useState("");
  const [thumbnailStyle, setThumbnailStyle] = useState<ThumbnailStyle>("bold");
  const [mainText, setMainText] = useState("");
  const [subText, setSubText] = useState("");
  const [description, setDescription] = useState("");
  const [composition, setComposition] = useState<ThumbnailComposition>("centered");
  const [cameraAngle, setCameraAngle] = useState<ThumbnailCameraAngle>("eye-level");
  const [lighting, setLighting] = useState<ThumbnailLighting>("natural");
  const [colorScheme, setColorScheme] = useState<ThumbnailColorScheme>("vibrant");
  const [textPosition, setTextPosition] = useState<ThumbnailTextPosition>("left");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [variationOpen, setVariationOpen] = useState(false);
  const [presetId, setPresetId] = useState("custom");
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [autoBlend, setAutoBlend] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [thumbnailData, setThumbnailData] = useState<string | null>(null);
  const [resultModel, setResultModel] = useState<string | null>(null);
  const [configuredModel, setConfiguredModel] = useState<ImageModelStatus | null>(null);
  const [modelStatusUnavailable, setModelStatusUnavailable] = useState(false);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationError, setGenerationError] = useState<RequestFailure | null>(null);
  const [variationDirection, setVariationDirection] = useState("");
  const [downloadedName, setDownloadedName] = useState<string | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    const cached = workflowState.cachedThumbnail;
    if (cached) {
      setTopic(cached.topic);
      setThumbnailStyle(cached.thumbnailStyle as ThumbnailStyle);
      setMainText(cached.mainText);
      setSubText(cached.subText);
      setDescription(cached.description);
      setComposition(cached.composition as ThumbnailComposition);
      setCameraAngle(cached.cameraAngle as ThumbnailCameraAngle);
      setLighting(cached.lighting as ThumbnailLighting);
      setColorScheme(cached.colorScheme as ThumbnailColorScheme);
      setTextPosition(cached.textPosition as ThumbnailTextPosition);
      setPresetId(cached.presetId);
      setAutoBlend(cached.autoBlend);
      setThumbnailData(cached.thumbnailData);
      setResultModel(cached.resultModel);
    } else if (selectedIdea) {
      setTopic(selectedIdea.title);
      setDescription(selectedIdea.thumbnailConcept);
    } else if (workflowState.cachedScript) {
      setTopic(workflowState.cachedScript.topic || workflowState.cachedScript.title || "");
    }
    setCacheReady(true);
  }, [workflowState.id]);

  useEffect(() => {
    if (!cacheReady || !workflowState.id) return;
    const timeout = window.setTimeout(() => {
      cacheThumbnailData({
        topic,
        thumbnailStyle,
        mainText,
        subText,
        description,
        composition,
        cameraAngle,
        lighting,
        colorScheme,
        textPosition,
        presetId,
        autoBlend,
        thumbnailData,
        resultModel,
        timestamp: Date.now(),
      });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [
    autoBlend, cacheReady, cacheThumbnailData, cameraAngle, colorScheme, composition,
    description, lighting, mainText, presetId, resultModel, subText, textPosition,
    thumbnailData, thumbnailStyle, topic, workflowState.id,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/settings/status", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Einstellungsstatus nicht verfügbar"); return response.json(); })
      .then((status) => {
        const option = status.models?.imageOptions?.find((item: ImageModelStatus) => item.id === status.models?.image);
        if (option) setConfiguredModel(option); else setModelStatusUnavailable(true);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setModelStatusUnavailable(true);
      });
    return () => controller.abort();
  }, []);

  const applyPreset = (preset: OutcomePreset) => {
    setPresetId(preset.id);
    setThumbnailStyle(preset.style); setMainText(t(preset.mainText)); setDescription(t(preset.description));
    setComposition(preset.composition); setCameraAngle(preset.cameraAngle); setLighting(preset.lighting);
    setColorScheme(preset.colorScheme); setTextPosition(preset.textPosition); setGenerationError(null);
  };

  const addReferenceFiles = async (files: File[]) => {
    const available = MAX_REFERENCE_IMAGES - references.length;
    if (available <= 0) {
      setGenerationError(localFailure(t("thumbnail.error.referenceLimitTitle"), t("thumbnail.error.referenceLimitSuggestion")));
      return;
    }
    const selectedFiles = files.slice(0, available);
    if (selectedFiles.length === 0) return;
    setReferencesLoading(true);
    try {
      const prepared = await Promise.all(selectedFiles.map(async (file) => ({ image: await prepareReferenceImage(file), role: "subject" as const, name: file.name })));
      setReferences((current) => [...current, ...prepared].slice(0, MAX_REFERENCE_IMAGES));
      setRightsConfirmed(false); setGenerationError(null);
    } catch (error) {
      setGenerationError(localFailure(t("thumbnail.error.referenceRejectedTitle"), error instanceof Error ? error.message : t("thumbnail.error.referenceRejectedSuggestion")));
    } finally { setReferencesLoading(false); }
  };

  const handleReferenceUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    void addReferenceFiles(files);
  };

  const handleReferenceDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void addReferenceFiles(Array.from(event.dataTransfer.files));
  };

  const generateThumbnail = async (mode: "create" | "variation" = "create") => {
    if (!topic.trim()) { setGenerationError(localFailure(t("thumbnail.error.topicRequiredTitle"), t("thumbnail.error.topicRequiredSuggestion"))); return; }
    if (references.length > 0 && !rightsConfirmed) { setGenerationError(localFailure(t("thumbnail.error.rightsRequiredTitle"), t("thumbnail.error.rightsRequiredSuggestion"))); return; }
    if (mode === "variation" && !variationDirection.trim()) { setGenerationError(localFailure(t("thumbnail.error.variationRequiredTitle"), t("thumbnail.error.variationRequiredSuggestion"))); return; }
    const requestReferences = mode === "variation" && thumbnailData
      ? [{ image: thumbnailData, role: "style" as const }, ...references.slice(0, 2).map(({ image, role }) => ({ image, role }))]
      : references.map(({ image, role }) => ({ image, role }));
    lastGenerationMode.current = mode;
    setGenerationLoading(true); setGenerationError(null); setDownloadedName(null);
    try {
      const response = await fetch("/api/thumbnail/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(), style: thumbnailStyle, mainText: mainText.trim(), subText: subText.trim(),
          thumbnailDescription: description.trim(), composition, cameraAngle, lighting, colorScheme, textPosition,
          autoBlend, referenceImages: requestReferences, referenceRightsConfirmed: requestReferences.length > 0,
          honestPromise: selectedIdea?.honestPromise, thumbnailConcept: selectedIdea?.thumbnailConcept,
          mode, variationDirection: mode === "variation" ? variationDirection.trim() : undefined,
        }),
      });
      if (!response.ok) throw await readFailure(response);
      const body = await response.json();
      if (typeof body.imageData !== "string" || !body.imageData.startsWith("data:image/")) throw localFailure(t("thumbnail.error.incompleteImageTitle"), t("thumbnail.error.incompleteImageSuggestion"));
      setThumbnailData(body.imageData); setResultModel(typeof body.model === "string" ? body.model : null);
      if (mode === "variation") setVariationDirection("");
    } catch (error) {
      setGenerationError(error && typeof error === "object" && "code" in error ? error as RequestFailure : localFailure(t("thumbnail.error.generationFailedTitle"), t("thumbnail.error.generationFailedSuggestion")));
    } finally { setGenerationLoading(false); }
  };

  const downloadThumbnail = () => {
    if (!thumbnailData) return;
    const extension = thumbnailData.startsWith("data:image/jpeg") ? "jpg" : "png";
    const safeTopic = topic.trim().slice(0, 40).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "youtube";
    const filename = `${safeTopic}-thumbnail.${extension}`;
    const link = document.createElement("a"); link.href = thumbnailData; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove(); setDownloadedName(filename);
  };

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-5 p-3 sm:p-5 lg:p-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ImageIcon className="h-5 w-5" aria-hidden="true" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{t("thumbnail.title")}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("thumbnail.intro")}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" />{t("thumbnail.outputNote")}</p>
            </div>
          </div>
          {configuredModel ? (
            <div className="max-w-sm rounded-lg border bg-card/70 px-3 py-2 text-xs"><p className="font-medium">{configuredModel.label}</p><p className="mt-0.5 text-muted-foreground">{configuredModel.id}</p></div>
          ) : modelStatusUnavailable ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setLocation("/settings")}><Settings className="mr-2 h-4 w-4" />{t("thumbnail.checkImageModel")}</Button>
          ) : <Skeleton className="h-12 w-48" aria-label={t("thumbnail.modelLoading")} />}
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
          <Card className="min-w-0 border-border/70 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">{t("thumbnail.createTitle")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("thumbnail.createIntro")}</p>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedIdea && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="font-medium text-foreground">{t("thumbnail.ideaLoaded")}</p>
                  <p className="mt-1 text-muted-foreground">{selectedIdea.thumbnailConcept}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{t("thumbnail.promise", { promise: selectedIdea.honestPromise })}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="thumbnail-topic">{t("thumbnail.topicLabel")}</Label>
                <Input id="thumbnail-topic" value={topic} maxLength={200} onChange={(event) => setTopic(event.target.value)} placeholder={t("thumbnail.topicPlaceholder")} data-testid="input-topic" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="thumbnail-preset">{t("thumbnail.presetLabel")}</Label>
                  <Select value={presetId} onValueChange={(value) => {
                    setPresetId(value);
                    const preset = outcomePresets.find((item) => item.id === value);
                    if (preset) applyPreset(preset);
                  }}>
                    <SelectTrigger id="thumbnail-preset"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">{t("thumbnail.preset.custom")}</SelectItem>
                      {outcomePresets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{t(preset.label)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="thumbnail-main-text">{t("thumbnail.mainTextLabel")}</Label>
                  <Input id="thumbnail-main-text" value={mainText} maxLength={50} onChange={(event) => setMainText(event.target.value)} placeholder={t("thumbnail.mainTextPlaceholder")} data-testid="input-thumbnail-text" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail-description">{t("thumbnail.descriptionLabel")}</Label>
                <div className="rounded-xl border border-border bg-muted/20 p-2 focus-within:ring-2 focus-within:ring-ring">
                  <Textarea
                    id="thumbnail-description"
                    value={description}
                    maxLength={1000}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={t("thumbnail.descriptionPlaceholder")}
                    className="min-h-32 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0"
                    data-testid="input-thumbnail-description"
                  />
                  <div className="flex items-center justify-between px-1 pb-1 text-xs text-muted-foreground"><span>{t("thumbnail.descriptionHint")}</span><span>{description.length}/1000</span></div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{t("thumbnail.referencesTitle")}</p><p className="text-xs text-muted-foreground">{t("thumbnail.referencesHint")}</p></div><span className="text-xs text-muted-foreground">{references.length}/{MAX_REFERENCE_IMAGES}</span></div>
                <input ref={referenceInputRef} id="thumbnail-references" type="file" accept="image/png,image/jpeg" multiple className="sr-only" onChange={handleReferenceUpload} disabled={references.length >= MAX_REFERENCE_IMAGES || referencesLoading} data-testid="input-add-reference" />
                <div
                  className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/15 px-4 text-center"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleReferenceDrop}
                >
                  {referencesLoading ? <Loader2 className="mb-2 h-5 w-5 animate-spin text-primary" /> : <ImagePlus className="mb-2 h-5 w-5 text-muted-foreground" />}
                  <p className="text-sm font-medium">{t("thumbnail.dropHere")}</p>
                  <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => referenceInputRef.current?.click()} disabled={references.length >= MAX_REFERENCE_IMAGES || referencesLoading}>{referencesLoading ? t("thumbnail.preparingImages") : t("thumbnail.chooseFiles")}</Button>
                </div>

                {references.length > 0 && <div className="grid gap-3 sm:grid-cols-3">{references.map((reference, index) => (
                  <div key={`${reference.name}-${index}`} className="rounded-lg border border-border p-2">
                    <img src={reference.image} alt={t("thumbnail.referenceAlt", { index: index + 1, name: reference.name })} className="aspect-video w-full rounded-md bg-muted object-cover" />
                    <div className="mt-2 flex items-center gap-1">
                      <Select value={reference.role} onValueChange={(role: ReferenceRole) => setReferences((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, role } : item))}>
                        <SelectTrigger className="h-9 min-w-0 flex-1" aria-label={t("thumbnail.referenceRoleLabel", { index: index + 1 })}><SelectValue /></SelectTrigger>
                        <SelectContent>{imageRoleOptions.map(([value, labelKey]) => <SelectItem key={value} value={value}>{t(labelKey)}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => { setReferences((current) => current.filter((_, itemIndex) => itemIndex !== index)); setRightsConfirmed(false); }} aria-label={t("thumbnail.referenceRemoveLabel", { index: index + 1, name: reference.name })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}</div>}

                {references.length > 0 && <div className="flex items-start gap-3 rounded-lg border border-border p-3"><Checkbox id="thumbnail-rights" checked={rightsConfirmed} onCheckedChange={(checked) => setRightsConfirmed(checked === true)} /><Label htmlFor="thumbnail-rights" className="text-sm font-normal leading-5">{t("thumbnail.rightsLabel")}</Label></div>}
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="w-full justify-between border-t border-border pt-4" aria-expanded={advancedOpen} data-testid="button-toggle-advanced"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />{t("thumbnail.advancedSettings")}</span><ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} /></Button></CollapsibleTrigger>
                <CollapsibleContent className="pt-4"><div className="grid gap-4 sm:grid-cols-2">
                  <LabeledSelect id="thumbnail-style" label={t("thumbnail.styleLabel")} value={thumbnailStyle} options={thumbnailStyles} onChange={(value) => setThumbnailStyle(value as ThumbnailStyle)} />
                  <div className="space-y-2"><Label htmlFor="thumbnail-subtext">{t("thumbnail.subTextLabel")}</Label><Input id="thumbnail-subtext" value={subText} maxLength={80} onChange={(event) => setSubText(event.target.value)} placeholder={t("thumbnail.subTextPlaceholder")} data-testid="input-thumbnail-subtext" /></div>
                  <LabeledSelect id="thumbnail-composition" label={t("thumbnail.compositionLabel")} value={composition} options={compositionOptions} onChange={(value) => setComposition(value as ThumbnailComposition)} />
                  <LabeledSelect id="thumbnail-camera-angle" label={t("thumbnail.cameraLabel")} value={cameraAngle} options={cameraAngleOptions} onChange={(value) => setCameraAngle(value as ThumbnailCameraAngle)} />
                  <LabeledSelect id="thumbnail-lighting" label={t("thumbnail.lightingLabel")} value={lighting} options={lightingOptions} onChange={(value) => setLighting(value as ThumbnailLighting)} />
                  <LabeledSelect id="thumbnail-color" label={t("thumbnail.colorLabel")} value={colorScheme} options={colorSchemeOptions} onChange={(value) => setColorScheme(value as ThumbnailColorScheme)} />
                  <LabeledSelect id="thumbnail-text-position" label={t("thumbnail.textPositionLabel")} value={textPosition} options={textPositionOptions} onChange={(value) => { const position = value as ThumbnailTextPosition; setTextPosition(position); if (position === "none") { setMainText(""); setSubText(""); } }} />
                  {references.length > 0 && <div className="flex items-start gap-3 pt-2"><Switch id="thumbnail-auto-blend" checked={autoBlend} onCheckedChange={setAutoBlend} /><div><Label htmlFor="thumbnail-auto-blend">{t("thumbnail.autoBlendLabel")}</Label><p className="mt-1 text-xs text-muted-foreground">{t("thumbnail.autoBlendHint")}</p></div></div>}
                </div></CollapsibleContent>
              </Collapsible>

              {generationError && <FailurePanel failure={generationError} busy={generationLoading} onRetry={() => void generateThumbnail(lastGenerationMode.current)} onSettings={() => setLocation("/settings")} />}
              <Button type="button" size="lg" className="min-h-12 w-full" onClick={() => void generateThumbnail("create")} disabled={generationLoading} data-testid="button-generate-thumbnail">{generationLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}{generationLoading ? t("thumbnail.generating") : t("thumbnail.generate")}</Button>
            </CardContent>
          </Card>

          <aside className="min-w-0 lg:sticky lg:top-5"><Card className="border-border/70 shadow-sm"><CardHeader><CardTitle className="text-lg">{t("thumbnail.previewTitle")}</CardTitle></CardHeader><CardContent className="space-y-4">
            {generationLoading ? <div className="space-y-3" role="status" aria-live="polite"><Skeleton className="aspect-video w-full" /><p className="text-sm text-muted-foreground">{t("thumbnail.previewLoading")}</p></div> : thumbnailData ? <>
              <div className="overflow-hidden rounded-lg border bg-muted"><img src={thumbnailData} alt={t("thumbnail.generatedAlt")} className="aspect-video w-full object-cover" data-testid="img-generated-thumbnail" /></div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row"><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={downloadThumbnail} data-testid="button-download-thumbnail"><Download className="mr-2 h-4 w-4" />{t("common.download")}</Button><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => void generateThumbnail("create")} disabled={generationLoading}><RefreshCw className="mr-2 h-4 w-4" />{t("thumbnail.newVersion")}</Button></div>
              {downloadedName && <p className="flex items-center gap-2 text-sm text-success" role="status"><CheckCircle2 className="h-4 w-4" />{t("thumbnail.downloadedAs", { name: downloadedName })}</p>}
              <Collapsible open={variationOpen} onOpenChange={setVariationOpen}><CollapsibleTrigger asChild><Button type="button" variant="ghost" className="w-full justify-between"><span className="flex items-center gap-2"><Wand2 className="h-4 w-4" />{t("thumbnail.createVariation")}</span><ChevronDown className={`h-4 w-4 transition-transform ${variationOpen ? "rotate-180" : ""}`} /></Button></CollapsibleTrigger><CollapsibleContent className="space-y-2 pt-3"><Textarea id="thumbnail-variation" value={variationDirection} maxLength={500} onChange={(event) => setVariationDirection(event.target.value)} placeholder={t("thumbnail.variationPlaceholder")} className="min-h-20" /><Button type="button" className="min-h-11 w-full" onClick={() => void generateThumbnail("variation")} disabled={generationLoading || !variationDirection.trim()} data-testid="button-generate-variation"><Wand2 className="mr-2 h-4 w-4" />{t("thumbnail.generateVariation")}</Button></CollapsibleContent></Collapsible>
              <p className="text-center text-xs text-muted-foreground">{t("thumbnail.generatedWith", { model: resultModel || configuredModel?.label || t("thumbnail.configuredModelFallback") })}</p>
            </> : <div className="flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center"><ImageIcon className="mb-3 h-7 w-7 text-muted-foreground" /><p className="font-medium">{t("thumbnail.emptyTitle")}</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">{t("thumbnail.emptyHint")}</p></div>}
          </CardContent></Card></aside>
        </div>
      </div>
    </div>
  );
}
