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

const MAX_INPUT_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_GENERATION_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REFERENCE_IMAGES = 3;

const thumbnailStyles = [
  ["bold", "Kräftig und dramatisch"], ["minimal", "Klar und minimalistisch"], ["gaming", "Gaming"],
  ["vlog", "Vlog und Lifestyle"], ["tutorial", "Lehrreich"], ["cinematic", "Filmisch"],
  ["tech", "Tech und modern"], ["lifestyle", "Lifestyle und Wellness"],
] as const;
const compositionOptions = [
  ["centered", "Zentriert"], ["rule-of-thirds", "Drittelregel"], ["close-up", "Nahaufnahme"],
  ["wide-shot", "Totale"], ["split-screen", "Geteilter Bildschirm"], ["diagonal", "Diagonal"],
] as const;
const cameraAngleOptions = [
  ["eye-level", "Augenhöhe"], ["low-angle", "Froschperspektive"], ["high-angle", "Vogelperspektive"],
  ["dutch-angle", "Schräge Kamera"], ["overhead", "Von oben"], ["three-quarter", "Dreiviertelansicht"],
] as const;
const lightingOptions = [
  ["natural", "Natürlich"], ["dramatic", "Dramatisch"], ["golden-hour", "Goldene Stunde"],
  ["studio", "Studio"], ["neon", "Neon und RGB"], ["backlit", "Gegenlicht"], ["soft", "Weich und diffus"],
] as const;
const colorSchemeOptions = [
  ["vibrant", "Leuchtend"], ["muted", "Gedämpft und elegant"], ["warm", "Warme Töne"],
  ["cool", "Kühle Töne"], ["monochrome", "Monochrom"], ["complementary", "Komplementär"],
  ["brand-colors", "Markenfarben"],
] as const;
const textPositionOptions = [
  ["left", "Links"], ["right", "Rechts"], ["center", "Mitte"], ["top", "Oben"],
  ["bottom", "Unten"], ["none", "Kein Textbereich"],
] as const;
const imageRoleOptions = [
  ["subject", "Motiv oder Person"], ["style", "Stilrichtung"],
  ["background", "Hintergrund"], ["composition", "Komposition"],
] as const;

type ThumbnailStyle = (typeof thumbnailStyles)[number][0];
type ThumbnailComposition = (typeof compositionOptions)[number][0];
type ThumbnailCameraAngle = (typeof cameraAngleOptions)[number][0];
type ThumbnailLighting = (typeof lightingOptions)[number][0];
type ThumbnailColorScheme = (typeof colorSchemeOptions)[number][0];
type ThumbnailTextPosition = (typeof textPositionOptions)[number][0];
type ReferenceRole = (typeof imageRoleOptions)[number][0];
type ReferenceImage = { image: string; role: ReferenceRole; name: string };
type RequestFailure = { error: string; code: string; category: string; retryable: boolean; suggestion: string };
type ImageModelStatus = { id: string; label: string; description: string };
type SelectOption = readonly [string, string];
type OutcomePreset = {
  id: string; label: string; mainText: string; description: string; style: ThumbnailStyle;
  composition: ThumbnailComposition; cameraAngle: ThumbnailCameraAngle; lighting: ThumbnailLighting;
  colorScheme: ThumbnailColorScheme; textPosition: ThumbnailTextPosition;
};

const outcomePresets: OutcomePreset[] = [
  { id: "tutorial", label: "Tutorial oder Demo", mainText: "So funktioniert es", description: "Zeige die Handlung und das sichtbare Ergebnis in einer einfachen, erklärenden Szene.", style: "tutorial", composition: "rule-of-thirds", cameraAngle: "three-quarter", lighting: "studio", colorScheme: "complementary", textPosition: "right" },
  { id: "comparison", label: "Vergleich oder Versus", mainText: "Im Vergleich", description: "Gib beiden Optionen das gleiche visuelle Gewicht und mache die Vergleichsgrundlage klar erkennbar.", style: "minimal", composition: "split-screen", cameraAngle: "eye-level", lighting: "studio", colorScheme: "complementary", textPosition: "top" },
  { id: "result", label: "Ergebnis-Enthüllung", mainText: "Das Ergebnis", description: "Stelle das echte Ergebnis in den Vordergrund, ohne eine unbelegte Vorher-Nachher-Behauptung aufzustellen.", style: "bold", composition: "close-up", cameraAngle: "eye-level", lighting: "dramatic", colorScheme: "vibrant", textPosition: "left" },
  { id: "case-study", label: "Fallstudie", mainText: "Was sich geändert hat", description: "Zeige das echte Motiv und eine konkrete, belegbare Veränderung aus der Fallstudie.", style: "minimal", composition: "rule-of-thirds", cameraAngle: "eye-level", lighting: "natural", colorScheme: "muted", textPosition: "right" },
  { id: "news", label: "News oder Update", mainText: "Was sich geändert hat", description: "Zeige das Update selbst mit klarer Hierarchie und ohne künstliche Dringlichkeit.", style: "tech", composition: "wide-shot", cameraAngle: "eye-level", lighting: "studio", colorScheme: "cool", textPosition: "left" },
  { id: "list", label: "Liste oder Ranking", mainText: "Top-Auswahl", description: "Zeige den führenden Eintrag und genug Nebenhinweise, um eine Rangfolge zu vermitteln.", style: "bold", composition: "diagonal", cameraAngle: "high-angle", lighting: "dramatic", colorScheme: "complementary", textPosition: "left" },
  { id: "review", label: "Produkt- oder Tool-Review", mainText: "Lohnt es sich?", description: "Zeige das genaue Produkt deutlich und stelle die Bewertungsfrage, ohne ein Urteil vorwegzunehmen.", style: "tech", composition: "centered", cameraAngle: "three-quarter", lighting: "studio", colorScheme: "cool", textPosition: "right" },
];

function localFailure(error: string, suggestion: string): RequestFailure {
  return { error, code: "THUMBNAIL_CLIENT_VALIDATION", category: "invalid_response", retryable: false, suggestion };
}

async function readFailure(response: Response): Promise<RequestFailure> {
  let body: Partial<RequestFailure> = {};
  try { body = await response.json(); } catch { body = {}; }
  return {
    error: body.error || `Anfrage fehlgeschlagen mit Status ${response.status}`,
    code: body.code || `HTTP_${response.status}`,
    category: body.category || (response.status === 429 ? "quota" : "unknown"),
    retryable: body.retryable ?? response.status >= 429,
    suggestion: body.suggestion || "Versuche es einmal erneut. Wenn das Problem bleibt, prüfe die Einstellungen und die Server-Logs.",
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Die ausgewählte Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Die ausgewählte Datei konnte nicht als Bild dekodiert werden."));
    image.src = dataUrl;
  });
}

async function prepareReferenceImage(file: File): Promise<string> {
  if (file.type !== "image/png" && file.type !== "image/jpeg") throw new Error("Wähle ein PNG- oder JPEG-Bild.");
  if (file.size > MAX_INPUT_IMAGE_BYTES) throw new Error("Wähle ein Bild, das kleiner als 10 MB ist.");
  const original = await readFileAsDataUrl(file);
  const image = await loadImage(original);
  if (image.naturalWidth < 128 || image.naturalHeight < 128 || image.naturalWidth > 4096 || image.naturalHeight > 4096) {
    throw new Error("Die Bildmaße müssen zwischen 128 und 4096 Pixeln liegen.");
  }
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Dieser Browser konnte das Bild nicht vorbereiten.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const prepared = canvas.toDataURL("image/jpeg", 0.86);
  const approximateBytes = Math.ceil((prepared.length - prepared.indexOf(",") - 1) * 0.75);
  if (approximateBytes > MAX_GENERATION_IMAGE_BYTES) throw new Error("Das vorbereitete Bild ist immer noch größer als 5 MB. Wähle ein einfacheres oder kleineres Bild.");
  return prepared;
}

function FailurePanel({ failure, busy, onRetry, onSettings }: { failure: RequestFailure; busy: boolean; onRetry: () => void; onSettings: () => void }) {
  const needsSettings = failure.category === "missing_key" || failure.category === "invalid_key";
  return (
    <Alert variant="destructive" data-testid="thumbnail-error">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{failure.error}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{failure.suggestion}</p>
        <div className="flex flex-wrap gap-2">
          {failure.retryable && <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Erneut versuchen</Button>}
          {needsSettings && <Button type="button" size="sm" variant="outline" onClick={onSettings}><Settings className="mr-2 h-4 w-4" />Einstellungen öffnen</Button>}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function LabeledSelect({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: ReadonlyArray<SelectOption>; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([optionValue, optionLabel]) => <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

export default function ThumbnailPage() {
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
    setThumbnailStyle(preset.style); setMainText(preset.mainText); setDescription(preset.description);
    setComposition(preset.composition); setCameraAngle(preset.cameraAngle); setLighting(preset.lighting);
    setColorScheme(preset.colorScheme); setTextPosition(preset.textPosition); setGenerationError(null);
  };

  const addReferenceFiles = async (files: File[]) => {
    const available = MAX_REFERENCE_IMAGES - references.length;
    if (available <= 0) {
      setGenerationError(localFailure("Referenzlimit erreicht", "Entferne ein Bild, bevor du ein weiteres hinzufügst. Du kannst bis zu drei Referenzen verwenden."));
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
      setGenerationError(localFailure("Referenzbild nicht akzeptiert", error instanceof Error ? error.message : "Wähle ein anderes PNG- oder JPEG-Bild."));
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
    if (!topic.trim()) { setGenerationError(localFailure("Thema erforderlich", "Gib ein konkretes Videothema an, bevor du generierst.")); return; }
    if (references.length > 0 && !rightsConfirmed) { setGenerationError(localFailure("Bestätigung der Nutzungsrechte erforderlich", "Bestätige, dass du die Erlaubnis hast, jede hochgeladene Referenz zu verwenden.")); return; }
    if (mode === "variation" && !variationDirection.trim()) { setGenerationError(localFailure("Richtung für die Variante erforderlich", "Beschreibe, was sich in der nächsten Variante ändern soll.")); return; }
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
      if (typeof body.imageData !== "string" || !body.imageData.startsWith("data:image/")) throw localFailure("Die Bildantwort war unvollständig", "Versuche es einmal erneut. Wenn das Problem bleibt, wähle in den Einstellungen ein anderes unterstütztes Bildmodell.");
      setThumbnailData(body.imageData); setResultModel(typeof body.model === "string" ? body.model : null);
      if (mode === "variation") setVariationDirection("");
    } catch (error) {
      setGenerationError(error && typeof error === "object" && "code" in error ? error as RequestFailure : localFailure("Thumbnail konnte nicht generiert werden", "Prüfe die Serververbindung und versuche es erneut."));
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
              <h1 className="text-2xl font-semibold tracking-tight">Thumbnail-Creator</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Beschreibe das Thumbnail einmal. Der Creator wendet das ausgewählte Recherche-Versprechen und die YouTube-Lesbarkeitsregeln an.</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" />16:9-Ausgabe, ohne sichtbares App-Wasserzeichen. Die unsichtbare SynthID-Herkunftskennzeichnung bleibt erhalten.</p>
            </div>
          </div>
          {configuredModel ? (
            <div className="max-w-sm rounded-lg border bg-card/70 px-3 py-2 text-xs"><p className="font-medium">{configuredModel.label}</p><p className="mt-0.5 text-muted-foreground">{configuredModel.id}</p></div>
          ) : modelStatusUnavailable ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setLocation("/settings")}><Settings className="mr-2 h-4 w-4" />Bildmodell prüfen</Button>
          ) : <Skeleton className="h-12 w-48" aria-label="Konfiguriertes Bildmodell wird geladen" />}
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
          <Card className="min-w-0 border-border/70 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Thumbnail erstellen</CardTitle>
              <p className="text-sm text-muted-foreground">Starte mit einem klaren Versprechen und einer visuellen Idee. Referenzen und Detaileinstellungen sind optional.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedIdea && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="font-medium text-foreground">Recherche-Idee geladen</p>
                  <p className="mt-1 text-muted-foreground">{selectedIdea.thumbnailConcept}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Versprechen: {selectedIdea.honestPromise}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="thumbnail-topic">Videothema oder Titel</Label>
                <Input id="thumbnail-topic" value={topic} maxLength={200} onChange={(event) => setTopic(event.target.value)} placeholder="Worum geht es im Video?" data-testid="input-topic" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="thumbnail-preset">Ausgangspunkt</Label>
                  <Select value={presetId} onValueChange={(value) => {
                    setPresetId(value);
                    const preset = outcomePresets.find((item) => item.id === value);
                    if (preset) applyPreset(preset);
                  }}>
                    <SelectTrigger id="thumbnail-preset"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Mein Briefing verwenden</SelectItem>
                      {outcomePresets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="thumbnail-main-text">Text auf dem Thumbnail</Label>
                  <Input id="thumbnail-main-text" value={mainText} maxLength={50} onChange={(event) => setMainText(event.target.value)} placeholder="Optional, 2 bis 5 Wörter" data-testid="input-thumbnail-text" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail-description">Beschreibe das gewünschte Thumbnail</Label>
                <div className="rounded-xl border border-border bg-muted/20 p-2 focus-within:ring-2 focus-within:ring-ring">
                  <Textarea
                    id="thumbnail-description"
                    value={description}
                    maxLength={1000}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Beispiel: Eine Nahaufnahme eines Creators, der überrascht auf ein aufgeräumtes Analytics-Dashboard schaut, starker Kontrast, Motiv rechts, Platz für kurzen Text links."
                    className="min-h-32 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0"
                    data-testid="input-thumbnail-description"
                  />
                  <div className="flex items-center justify-between px-1 pb-1 text-xs text-muted-foreground"><span>Motiv, Handlung, Umgebung und ehrliches Ergebnis</span><span>{description.length}/1000</span></div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Referenzbilder</p><p className="text-xs text-muted-foreground">Optional, bis zu drei freigegebene PNG- oder JPEG-Bilder.</p></div><span className="text-xs text-muted-foreground">{references.length}/{MAX_REFERENCE_IMAGES}</span></div>
                <input ref={referenceInputRef} id="thumbnail-references" type="file" accept="image/png,image/jpeg" multiple className="sr-only" onChange={handleReferenceUpload} disabled={references.length >= MAX_REFERENCE_IMAGES || referencesLoading} data-testid="input-add-reference" />
                <div
                  className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/15 px-4 text-center"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleReferenceDrop}
                >
                  {referencesLoading ? <Loader2 className="mb-2 h-5 w-5 animate-spin text-primary" /> : <ImagePlus className="mb-2 h-5 w-5 text-muted-foreground" />}
                  <p className="text-sm font-medium">Bilder hierher ziehen</p>
                  <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => referenceInputRef.current?.click()} disabled={references.length >= MAX_REFERENCE_IMAGES || referencesLoading}>{referencesLoading ? "Bilder werden vorbereitet" : "oder Dateien auswählen"}</Button>
                </div>

                {references.length > 0 && <div className="grid gap-3 sm:grid-cols-3">{references.map((reference, index) => (
                  <div key={`${reference.name}-${index}`} className="rounded-lg border border-border p-2">
                    <img src={reference.image} alt={`Referenz ${index + 1}: ${reference.name}`} className="aspect-video w-full rounded-md bg-muted object-cover" />
                    <div className="mt-2 flex items-center gap-1">
                      <Select value={reference.role} onValueChange={(role: ReferenceRole) => setReferences((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, role } : item))}>
                        <SelectTrigger className="h-9 min-w-0 flex-1" aria-label={`Rolle für Referenz ${index + 1}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{imageRoleOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => { setReferences((current) => current.filter((_, itemIndex) => itemIndex !== index)); setRightsConfirmed(false); }} aria-label={`Referenz ${index + 1} entfernen: ${reference.name}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}</div>}

                {references.length > 0 && <div className="flex items-start gap-3 rounded-lg border border-border p-3"><Checkbox id="thumbnail-rights" checked={rightsConfirmed} onCheckedChange={(checked) => setRightsConfirmed(checked === true)} /><Label htmlFor="thumbnail-rights" className="text-sm font-normal leading-5">Ich habe die Erlaubnis, jedes hochgeladene Referenzbild zu verwenden.</Label></div>}
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="w-full justify-between border-t border-border pt-4" aria-expanded={advancedOpen} data-testid="button-toggle-advanced"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Erweiterte Einstellungen</span><ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} /></Button></CollapsibleTrigger>
                <CollapsibleContent className="pt-4"><div className="grid gap-4 sm:grid-cols-2">
                  <LabeledSelect id="thumbnail-style" label="Visueller Stil" value={thumbnailStyle} options={thumbnailStyles} onChange={(value) => setThumbnailStyle(value as ThumbnailStyle)} />
                  <div className="space-y-2"><Label htmlFor="thumbnail-subtext">Zweittext</Label><Input id="thumbnail-subtext" value={subText} maxLength={80} onChange={(event) => setSubText(event.target.value)} placeholder="Optionale ergänzende Zeile" data-testid="input-thumbnail-subtext" /></div>
                  <LabeledSelect id="thumbnail-composition" label="Komposition" value={composition} options={compositionOptions} onChange={(value) => setComposition(value as ThumbnailComposition)} />
                  <LabeledSelect id="thumbnail-camera-angle" label="Kameraperspektive" value={cameraAngle} options={cameraAngleOptions} onChange={(value) => setCameraAngle(value as ThumbnailCameraAngle)} />
                  <LabeledSelect id="thumbnail-lighting" label="Licht" value={lighting} options={lightingOptions} onChange={(value) => setLighting(value as ThumbnailLighting)} />
                  <LabeledSelect id="thumbnail-color" label="Farbschema" value={colorScheme} options={colorSchemeOptions} onChange={(value) => setColorScheme(value as ThumbnailColorScheme)} />
                  <LabeledSelect id="thumbnail-text-position" label="Textposition" value={textPosition} options={textPositionOptions} onChange={(value) => { const position = value as ThumbnailTextPosition; setTextPosition(position); if (position === "none") { setMainText(""); setSubText(""); } }} />
                  {references.length > 0 && <div className="flex items-start gap-3 pt-2"><Switch id="thumbnail-auto-blend" checked={autoBlend} onCheckedChange={setAutoBlend} /><div><Label htmlFor="thumbnail-auto-blend">Referenzen zu einer Szene verschmelzen</Label><p className="mt-1 text-xs text-muted-foreground">Ausgeschaltet dienen sie nur als Orientierung.</p></div></div>}
                </div></CollapsibleContent>
              </Collapsible>

              {generationError && <FailurePanel failure={generationError} busy={generationLoading} onRetry={() => void generateThumbnail(lastGenerationMode.current)} onSettings={() => setLocation("/settings")} />}
              <Button type="button" size="lg" className="min-h-12 w-full" onClick={() => void generateThumbnail("create")} disabled={generationLoading} data-testid="button-generate-thumbnail">{generationLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}{generationLoading ? "Thumbnail wird erstellt" : "Thumbnail erstellen"}</Button>
            </CardContent>
          </Card>

          <aside className="min-w-0 lg:sticky lg:top-5"><Card className="border-border/70 shadow-sm"><CardHeader><CardTitle className="text-lg">Vorschau</CardTitle></CardHeader><CardContent className="space-y-4">
            {generationLoading ? <div className="space-y-3" role="status" aria-live="polite"><Skeleton className="aspect-video w-full" /><p className="text-sm text-muted-foreground">Ein 16:9-Bild wird mit dem konfigurierten Modell generiert. Das kann einen Moment dauern.</p></div> : thumbnailData ? <>
              <div className="overflow-hidden rounded-lg border bg-muted"><img src={thumbnailData} alt="Generiertes YouTube-Thumbnail" className="aspect-video w-full object-cover" data-testid="img-generated-thumbnail" /></div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row"><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={downloadThumbnail} data-testid="button-download-thumbnail"><Download className="mr-2 h-4 w-4" />Herunterladen</Button><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => void generateThumbnail("create")} disabled={generationLoading}><RefreshCw className="mr-2 h-4 w-4" />Neue Version</Button></div>
              {downloadedName && <p className="flex items-center gap-2 text-sm text-success" role="status"><CheckCircle2 className="h-4 w-4" />Heruntergeladen als {downloadedName}</p>}
              <Collapsible open={variationOpen} onOpenChange={setVariationOpen}><CollapsibleTrigger asChild><Button type="button" variant="ghost" className="w-full justify-between"><span className="flex items-center gap-2"><Wand2 className="h-4 w-4" />Variante erstellen</span><ChevronDown className={`h-4 w-4 transition-transform ${variationOpen ? "rotate-180" : ""}`} /></Button></CollapsibleTrigger><CollapsibleContent className="space-y-2 pt-3"><Textarea id="thumbnail-variation" value={variationDirection} maxLength={500} onChange={(event) => setVariationDirection(event.target.value)} placeholder="Was soll sich in der nächsten Version ändern?" className="min-h-20" /><Button type="button" className="min-h-11 w-full" onClick={() => void generateThumbnail("variation")} disabled={generationLoading || !variationDirection.trim()} data-testid="button-generate-variation"><Wand2 className="mr-2 h-4 w-4" />Variante generieren</Button></CollapsibleContent></Collapsible>
              <p className="text-center text-xs text-muted-foreground">Generiert mit {resultModel || configuredModel?.label || "dem konfigurierten Bildmodell"}</p>
            </> : <div className="flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center"><ImageIcon className="mb-3 h-7 w-7 text-muted-foreground" /><p className="font-medium">Dein Thumbnail erscheint hier</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">Gib ein Thema und ein kurzes visuelles Briefing an und erstelle dann das Thumbnail.</p></div>}
          </CardContent></Card></aside>
        </div>
      </div>
    </div>
  );
}
