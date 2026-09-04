export const GEMINI_TEXT_MODELS = [
  {
    id: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    description: "Empfohlener Standard für leistungsfähige, schnelle Recherche und Texterstellung.",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (Preview)",
    description: "Option mit dem stärksten Reasoning, dafür mit Preview-Stabilität und höherer Latenz.",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    description: "Ausgewogenes Modell der vorherigen Generation.",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    description: "Stabiles Allzweckmodell.",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    description: "Günstigere Wahl für hohes Volumen.",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    description: "Effizientes Modell einer früheren Generation.",
  },
] as const;

export const GEMINI_IMAGE_MODELS = [
  {
    id: "gemini-3.1-flash-image",
    label: "Nano Banana 2",
    description: "Empfohlene Balance aus Bildqualität, Geschwindigkeit und Kosten.",
  },
  {
    id: "gemini-3.1-flash-lite-image",
    label: "Nano Banana 2 Lite",
    description: "Schnellste und günstigste Bildoption.",
  },
  {
    id: "gemini-3-pro-image",
    label: "Nano Banana Pro",
    description: "Premium-Option für komplexe, hochpräzise Thumbnails.",
  },
  {
    id: "gemini-2.5-flash-image",
    label: "Nano Banana (legacy)",
    description: "Älteres Bildmodell, aus Kompatibilitätsgründen beibehalten.",
  },
] as const;

export const DEFAULT_GEMINI_TEXT_MODEL = GEMINI_TEXT_MODELS[0].id;
export const DEFAULT_GEMINI_IMAGE_MODEL = GEMINI_IMAGE_MODELS[0].id;

export type GeminiTextModel = (typeof GEMINI_TEXT_MODELS)[number]["id"];
export type GeminiImageModel = (typeof GEMINI_IMAGE_MODELS)[number]["id"];

export function isGeminiTextModel(value: string): value is GeminiTextModel {
  return GEMINI_TEXT_MODELS.some((model) => model.id === value);
}

export function isGeminiImageModel(value: string): value is GeminiImageModel {
  return GEMINI_IMAGE_MODELS.some((model) => model.id === value);
}

export function getGeminiImageModelLabel(modelId: string): string {
  return GEMINI_IMAGE_MODELS.find((model) => model.id === modelId)?.label || modelId;
}
