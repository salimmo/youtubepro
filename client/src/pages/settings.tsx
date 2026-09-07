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
import { useT } from "@/lib/i18n";

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
  const t = useT();
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
          {configured ? t("settings.configured") : t("settings.notConfigured")}
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
          placeholder={configured ? t("settings.newKeyPlaceholder") : t("settings.keyPlaceholder")}
          className="pr-11 font-mono"
          data-testid={`input-${id}`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0"
          onClick={() => setShowKey((visible) => !visible)}
          aria-label={showKey ? t("settings.hideKey", { label }) : t("settings.showKey", { label })}
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
  const t = useT();
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
        if (response.status === 403) throw new Error(t("settings.remoteHint"));
        if (!response.ok) throw new Error(data.error || t("settings.loadFailed"));
        const nextStatus = data as ApiKeyStatus;
        setStatus(nextStatus);
        setGeminiTextModel(nextStatus.models.text);
        setGeminiImageModel(nextStatus.models.image);
      } catch (error: any) {
        setLoadError(error?.message || t("settings.loadFailed"));
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
        title: t("settings.noChangesTitle"),
        description: t("settings.noChangesDescription"),
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
        title: t("settings.savedTitle"),
        description: t("settings.savedDescription"),
      });
    } catch (error: any) {
      toast({
        title: t("settings.saveFailedTitle"),
        description: typeof error?.message === "string" && error.message.startsWith("403")
          ? t("settings.remoteHint")
          : (error?.message || t("settings.saveFailedFallback")),
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
          <span className="text-sm font-medium">{t("settings.eyebrow")}</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold">{t("settings.title")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {t("settings.intro")}
        </p>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>{t("settings.storedLocallyTitle")}</AlertTitle>
        <AlertDescription>
          {t("settings.storedLocallyBefore")}<code>.env</code>{t("settings.storedLocallyAfter")}
        </AlertDescription>
      </Alert>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>{t("settings.unavailableTitle")}</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.connectionsTitle")}</CardTitle>
          <CardDescription>
            {t("settings.connectionsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("settings.loadingStatus")}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <KeyField
                id="youtube-api-key"
                label={t("settings.youtubeLabel")}
                description={t("settings.youtubeDescription")}
                configured={status.youtube}
                inputRef={youtubeKeyRef}
                providerUrl="https://console.cloud.google.com/apis/credentials"
                providerLabel={t("settings.youtubeProviderLabel")}
              />
              <KeyField
                id="gemini-api-key"
                label={t("settings.geminiLabel")}
                description={t("settings.geminiDescription")}
                configured={status.gemini}
                inputRef={geminiKeyRef}
                providerUrl="https://aistudio.google.com/apikey"
                providerLabel={t("settings.geminiProviderLabel")}
              >
                <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gemini-text-model">{t("settings.textModelLabel")}</Label>
                    <Select value={geminiTextModel} onValueChange={setGeminiTextModel}>
                      <SelectTrigger id="gemini-text-model" data-testid="select-gemini-text-model">
                        <SelectValue placeholder={t("settings.selectModel")} />
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
                    <Label htmlFor="gemini-image-model">{t("settings.imageModelLabel")}</Label>
                    <Select value={geminiImageModel} onValueChange={setGeminiImageModel}>
                      <SelectTrigger id="gemini-image-model" data-testid="select-gemini-image-model">
                        <SelectValue placeholder={t("settings.selectModel")} />
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
                  {t("settings.modelCatalog")}
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
                  {t("settings.saveApply")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
