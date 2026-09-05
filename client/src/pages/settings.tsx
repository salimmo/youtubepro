import { FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { ExternalLink, Eye, EyeOff, KeyRound, Loader2, Save, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ModelOption {
  id: string;
  label: string;
  description: string;
}

interface ApiKeyStatus {
  youtube: boolean;
  gemini: boolean;
  models: {
    text: string;
    image: string;
    textOptions: ModelOption[];
    imageOptions: ModelOption[];
  };
}

interface KeyFieldProps {
  id: string;
  label: string;
  description: string;
  configured: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  providerUrl: string;
  providerLabel: string;
  children?: ReactNode;
}

const REMOTE_SETTINGS_HINT =
  "Die Einstellungen sind Administratoren vorbehalten. "
  + "Bei einem Server-Deployment (z. B. über Coolify) kannst du die API-Schlüssel auch als Umgebungsvariablen anlegen.";

function KeyField({
  id,
  label,
  description,
  configured,
  inputRef,
  providerUrl,
  providerLabel,
  children,
}: KeyFieldProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label htmlFor={id} className="text-base">{label}</Label>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge
          variant="outline"
          className={configured
            ? "border-green-500/40 bg-green-500/10 text-green-500"
            : "text-muted-foreground"}
        >
          {configured ? "Konfiguriert" : "Nicht konfiguriert"}
        </Badge>
      </div>

      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          name={id}
          type={showKey ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          placeholder={configured ? "Neuen Schlüssel eingeben" : "API-Schlüssel einfügen"}
          className="pr-11 font-mono"
          data-testid={`input-${id}`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0"
          onClick={() => setShowKey((visible) => !visible)}
          aria-label={showKey ? `${label} verbergen` : `${label} anzeigen`}
        >
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>

      {children}

      <a
        href={providerUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        {providerLabel}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

export default function SettingsPage() {
  const [status, setStatus] = useState<ApiKeyStatus>({
    youtube: false,
    gemini: false,
    models: { text: "", image: "", textOptions: [], imageOptions: [] },
  });
  const [geminiTextModel, setGeminiTextModel] = useState("");
  const [geminiImageModel, setGeminiImageModel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const youtubeKeyRef = useRef<HTMLInputElement>(null);
  const geminiKeyRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch("/api/settings/status", { cache: "no-store" });
        const data = await response.json();
        if (response.status === 403) throw new Error(REMOTE_SETTINGS_HINT);
        if (!response.ok) throw new Error(data.error || "Einstellungen konnten nicht geladen werden.");
        const nextStatus = data as ApiKeyStatus;
        setStatus(nextStatus);
        setGeminiTextModel(nextStatus.models.text);
        setGeminiImageModel(nextStatus.models.image);
      } catch (error: any) {
        setLoadError(error?.message || "Einstellungen konnten nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    };

    loadStatus();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const youtubeApiKey = youtubeKeyRef.current?.value.trim() || "";
    const geminiApiKey = geminiKeyRef.current?.value.trim() || "";
    const modelsChanged = geminiTextModel !== status.models.text
      || geminiImageModel !== status.models.image;

    if (!youtubeApiKey && !geminiApiKey && !modelsChanged) {
      toast({
        title: "Keine Änderungen zum Speichern",
        description: "Gib einen neuen Schlüssel ein oder wähle ein anderes Modell.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiRequest("PUT", "/api/settings/api-keys", {
        ...(youtubeApiKey ? { youtubeApiKey } : {}),
        ...(geminiApiKey ? { geminiApiKey } : {}),
        geminiTextModel,
        geminiImageModel,
      }) as { success: boolean; status: ApiKeyStatus };

      setStatus(response.status);
      setGeminiTextModel(response.status.models.text);
      setGeminiImageModel(response.status.models.image);
      if (youtubeKeyRef.current) youtubeKeyRef.current.value = "";
      if (geminiKeyRef.current) geminiKeyRef.current.value = "";
      toast({
        title: "API-Einstellungen gespeichert",
        description: "Der lokale Server verwendet jetzt die aktualisierten Anbieter-Einstellungen.",
      });
    } catch (error: any) {
      toast({
        title: "Einstellungen konnten nicht gespeichert werden",
        description: typeof error?.message === "string" && error.message.startsWith("403")
          ? REMOTE_SETTINGS_HINT
          : (error?.message || "Prüfe den Schlüssel und versuche es erneut."),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6 md:p-8">
      <div>
        <div className="flex items-center gap-2 text-primary">
          <KeyRound className="h-5 w-5" />
          <span className="text-sm font-medium">Lokale Verbindungen</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold">Einstellungen</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Verbinde die Anbieter, die für die YouTube-Recherche und die KI-Generierung genutzt werden.
        </p>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Lokal gespeichert</AlertTitle>
        <AlertDescription>
          Schlüssel werden in die von Git ignorierte <code>.env</code>-Datei des
          Servers geschrieben, lesbar nur für den Besitzer. Gespeicherte Werte werden
          nie an den Browser zurückgegeben, und die Eingabefelder werden nach dem
          Speichern geleert. Änderungen an den Einstellungen werden nur von diesem
          Rechner aus akzeptiert.
        </AlertDescription>
      </Alert>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Einstellungen nicht verfügbar</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API-Verbindungen</CardTitle>
          <CardDescription>
            Lass ein konfiguriertes Feld leer, um den aktuellen Wert beizubehalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Verbindungsstatus wird geladen …
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <KeyField
                id="youtube-api-key"
                label="YouTube Data API"
                description="Erforderlich für die Videosuche und Recherchedaten."
                configured={status.youtube}
                inputRef={youtubeKeyRef}
                providerUrl="https://console.cloud.google.com/apis/credentials"
                providerLabel="Google-Cloud-Anmeldedaten öffnen"
              />
              <KeyField
                id="gemini-api-key"
                label="Gemini API"
                description="Erforderlich für Recherche-Insights, Ideen, Skripte und die Thumbnail-Generierung."
                configured={status.gemini}
                inputRef={geminiKeyRef}
                providerUrl="https://aistudio.google.com/apikey"
                providerLabel="Google AI Studio öffnen"
              >
                <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gemini-text-model">Modell für Recherche und Texte</Label>
                    <Select value={geminiTextModel} onValueChange={setGeminiTextModel}>
                      <SelectTrigger id="gemini-text-model" data-testid="select-gemini-text-model">
                        <SelectValue placeholder="Modell auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {status.models.textOptions.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {status.models.textOptions.find((model) => model.id === geminiTextModel)?.description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gemini-image-model">Bildmodell für Thumbnails</Label>
                    <Select value={geminiImageModel} onValueChange={setGeminiImageModel}>
                      <SelectTrigger id="gemini-image-model" data-testid="select-gemini-image-model">
                        <SelectValue placeholder="Modell auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {status.models.imageOptions.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {status.models.imageOptions.find((model) => model.id === geminiImageModel)?.description}
                    </p>
                  </div>
                </div>

                <a
                  href="https://ai.google.dev/gemini-api/docs/models"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  Offiziellen Gemini-Modellkatalog ansehen
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </KeyField>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isSaving || Boolean(loadError)} data-testid="button-save-api-settings">
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Speichern und anwenden
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
