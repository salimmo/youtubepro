import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { de as dateFnsDe, enUS as dateFnsEn } from "date-fns/locale";

// Leichtgewichtige Zweisprachigkeit (Deutsch/Englisch) ohne zusätzliche
// Abhängigkeit. Wörterbücher liegen unter client/src/locales/<bereich>.<de|en>.ts
// und werden per Vite-Glob automatisch eingesammelt. Jede Datei exportiert ein
// flaches Objekt { "bereich.schluessel": "Text" }. Platzhalter: {name}.

export type UiLanguage = "de" | "en";

export const UI_LANGUAGES: ReadonlyArray<{ code: UiLanguage; label: string; nativeLabel: string }> = [
  { code: "de", label: "Deutsch", nativeLabel: "Deutsch" },
  { code: "en", label: "Englisch", nativeLabel: "English" },
];

const STORAGE_KEY = "yp_ui_language";
export const UI_LANGUAGE_HEADER = "X-UI-Language";

type Dictionary = Record<string, string>;

type DictionaryModules = Record<string, { default: Dictionary }>;

// Unter Node (Tests via tsx) gibt es kein import.meta.glob; dort werden die
// Wörterbücher synchron aus dem locales-Ordner geladen, damit Helfer wie
// labels.ts und research-export.ts dieselben Texte liefern wie im Browser.
function loadDictionaryModulesInNode(): DictionaryModules {
  const fs = process.getBuiltinModule("node:fs");
  const path = process.getBuiltinModule("node:path");
  const { fileURLToPath } = process.getBuiltinModule("node:url");
  const { createRequire } = process.getBuiltinModule("node:module");
  const requireModule = createRequire(import.meta.url);
  const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../locales");
  const result: DictionaryModules = {};
  for (const file of fs.readdirSync(localesDir)) {
    if (!/\.(de|en)\.ts$/.test(file)) continue;
    const loaded = requireModule(path.join(localesDir, file)) as { default?: Dictionary } | Dictionary;
    const dictionary = (loaded as { default?: Dictionary }).default ?? (loaded as Dictionary);
    result[`../locales/${file}`] = { default: dictionary };
  }
  return result;
}

function loadDictionaryModules(): DictionaryModules {
  const inNode = typeof window === "undefined"
    && typeof process !== "undefined"
    && typeof process.getBuiltinModule === "function";
  if (inNode) return loadDictionaryModulesInNode();
  return import.meta.glob<{ default: Dictionary }>("../locales/*.{de,en}.ts", { eager: true });
}

const modules = loadDictionaryModules();

function collect(language: UiLanguage): Dictionary {
  const merged: Dictionary = {};
  for (const [path, module] of Object.entries(modules)) {
    if (!path.endsWith(`.${language}.ts`)) continue;
    Object.assign(merged, module.default);
  }
  return merged;
}

const dictionaries: Record<UiLanguage, Dictionary> = {
  de: collect("de"),
  en: collect("en"),
};

export function detectInitialLanguage(): UiLanguage {
  // Ohne Browser (Tests, Server-Bundles) bleibt Deutsch der Standard.
  if (typeof window === "undefined") return "de";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "de" || stored === "en") return stored;
  } catch {
    // localStorage nicht verfügbar
  }
  const navigatorLanguage = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "de";
  return navigatorLanguage.startsWith("en") ? "en" : "de";
}

// Wird auch außerhalb von React gebraucht (fetch-Header), deshalb modulweit.
let activeLanguage: UiLanguage = detectInitialLanguage();
export const LANGUAGE_EVENT = "yp:language";

export function getActiveLanguage(): UiLanguage {
  return activeLanguage;
}

export function persistLanguage(language: UiLanguage): void {
  const changed = activeLanguage !== language;
  activeLanguage = language;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // localStorage nicht verfügbar
  }
  if (typeof document !== "undefined") document.documentElement.lang = language;
  if (changed && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<UiLanguage>(LANGUAGE_EVENT, { detail: language }));
  }
}

// Sprache lokal setzen und, wenn angemeldet, am Benutzerkonto speichern.
export function setActiveLanguage(language: UiLanguage, options: { sync?: boolean } = {}): void {
  persistLanguage(language);
  if (options.sync === false) return;
  void fetch("/api/auth/locale", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", [UI_LANGUAGE_HEADER]: language },
    body: JSON.stringify({ locale: language }),
  }).catch(() => undefined);
}

// Hängt an jeden API-Aufruf den Sprach-Header an, damit der Server
// KI-Ausgaben und Fehlertexte in der Oberflächensprache liefert. Einmal beim
// Start aufrufen (main.tsx); erspart Änderungen an jedem fetch().
export function installLanguageHeader(): void {
  if (typeof window === "undefined" || (window as any).__ypLanguageHeaderInstalled) return;
  (window as any).__ypLanguageHeaderInstalled = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const sameOriginApi = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);
    if (!sameOriginApi) return originalFetch(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has(UI_LANGUAGE_HEADER)) headers.set(UI_LANGUAGE_HEADER, activeLanguage);
    return originalFetch(input, { ...init, headers });
  };
}

export type TranslateVars = Record<string, string | number>;

export function translate(language: UiLanguage, key: string, vars?: TranslateVars): string {
  const template = dictionaries[language][key] ?? dictionaries.de[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function intlLocale(language: UiLanguage): string {
  return language === "en" ? "en-US" : "de-DE";
}

export function dateFnsLocale(language: UiLanguage) {
  return language === "en" ? dateFnsEn : dateFnsDe;
}

export function formatNumber(language: UiLanguage, value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(intlLocale(language), options);
}

// Kompakte Zahlen: 1,2 Mio. / 1.2M, 12,5 Tsd. / 12.5K
export function formatCompact(language: UiLanguage, value: number | undefined | null): string {
  if (value == null) return language === "en" ? "n/a" : "k. A.";
  const locale = intlLocale(language);
  if (value >= 1_000_000) {
    const number = (value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 });
    return language === "en" ? `${number}M` : `${number} Mio.`;
  }
  if (value >= 1_000) {
    const number = (value / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 });
    return language === "en" ? `${number}K` : `${number} Tsd.`;
  }
  return value.toLocaleString(locale);
}

export function formatDate(language: UiLanguage, value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(intlLocale(language), options ?? { dateStyle: "medium", timeStyle: "short" });
}

interface I18nContextValue {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
  t: (key: string, vars?: TranslateVars) => string;
  locale: string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children, onChange }: { children: ReactNode; onChange?: (language: UiLanguage) => void }) {
  const [language, setLanguageState] = useState<UiLanguage>(() => getActiveLanguage());

  useEffect(() => {
    persistLanguage(language);
  }, [language]);

  // Änderungen von außerhalb (z. B. gespeicherte Sprache nach dem Login) übernehmen.
  useEffect(() => {
    const handler = (event: Event) => {
      const next = (event as CustomEvent<UiLanguage>).detail;
      if (next === "de" || next === "en") setLanguageState(next);
    };
    window.addEventListener(LANGUAGE_EVENT, handler);
    return () => window.removeEventListener(LANGUAGE_EVENT, handler);
  }, []);

  const setLanguage = useCallback((next: UiLanguage) => {
    setLanguageState(next);
    setActiveLanguage(next);
    onChange?.(next);
  }, [onChange]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    t: (key, vars) => translate(language, key, vars),
    locale: intlLocale(language),
  }), [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n muss innerhalb von I18nProvider verwendet werden.");
  return context;
}

// Kurzform für Komponenten: const t = useT();
export function useT() {
  return useI18n().t;
}
