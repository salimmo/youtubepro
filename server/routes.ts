import type { Express } from "express";
import { createServer, type Server } from "http";
import { searchVideos } from "./youtube";
import { generateScript, generateIdeas, generateResearchInsights, regenerateTitles, regenerateSection, regenerateParagraph, generateThumbnail, generateThumbnailSuggestions, extractNarrationText } from "./gemini";
import { ideaGenerationRequestSchema, researchInsightsRequestSchema, searchFiltersSchema, scriptInputSchema } from "@shared/schema";
import { z } from "zod";
import { apiKeySettingsSchema, getApiKeyStatus, isLocalSettingsRequest, saveApiKeySettings } from "./settings";
import { normalizeProviderError, providerErrorPayload } from "./provider-errors";
import { thumbnailGenerationRequestSchema, thumbnailSuggestionsRequestSchema } from "./thumbnail-contract";
import {
  paragraphRegenerationRequestSchema,
  sectionRegenerationRequestSchema,
} from "./script-regeneration-contract";
import {
  narrationExtractionRequestSchema,
  titleRegenerationRequestSchema,
} from "./api-contracts";
import { createRateLimiter } from "./rate-limit";

const { middleware: rateLimit } = createRateLimiter();

function getUserFriendlyError(error: any, context: string): { message: string; suggestion: string } {
  const errorMessage = error?.message?.toLowerCase() || "";

  if (errorMessage.includes("api key") || errorMessage.includes("authentication") || errorMessage.includes("unauthorized")) {
    return {
      message: `${context} ist vorübergehend nicht verfügbar`,
      suggestion: "Bitte versuche es gleich noch einmal. Wenn das Problem weiterhin besteht, wende dich an den Support."
    };
  }

  if (errorMessage.includes("rate limit") || errorMessage.includes("quota") || errorMessage.includes("too many")) {
    return {
      message: `${context} ist derzeit stark ausgelastet`,
      suggestion: "Bitte warte eine Minute und versuche es erneut."
    };
  }

  if (errorMessage.includes("timeout") || errorMessage.includes("timed out") || errorMessage.includes("network")) {
    return {
      message: `${context} hat zu lange für eine Antwort gebraucht`,
      suggestion: "Bitte prüfe deine Verbindung und versuche es erneut."
    };
  }

  if (errorMessage.includes("content") || errorMessage.includes("safety") || errorMessage.includes("blocked")) {
    return {
      message: `${context} konnte diesen Inhalt nicht verarbeiten`,
      suggestion: "Formuliere deine Anfrage um oder verwende andere Keywords."
    };
  }

  return {
    message: `${context} ist auf ein Problem gestoßen`,
    suggestion: "Bitte versuche es erneut. Wenn das Problem weiterhin besteht, lade die Seite neu."
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/settings/status", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!isLocalSettingsRequest(req)) {
      return res.status(403).json({ error: "Die Einstellungen sind nur von diesem Rechner aus verfügbar." });
    }
    return res.json(getApiKeyStatus());
  });

  app.put("/api/settings/api-keys", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!isLocalSettingsRequest(req)) {
      return res.status(403).json({ error: "Die Einstellungen sind nur von diesem Rechner aus verfügbar." });
    }

    try {
      const input = apiKeySettingsSchema.parse(req.body);
      const status = await saveApiKeySettings(input);
      return res.json({ success: true, status });
    } catch (error: any) {
      return res.status(400).json({
        error: error?.message || "API-Einstellungen konnten nicht gespeichert werden.",
      });
    }
  });

  app.get("/api/youtube/search", rateLimit, async (req, res) => {
    try {
      const { query, uploadDate, duration, sortBy, maxResults } = req.query;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Ein Suchbegriff ist erforderlich" });
      }

      const filters = searchFiltersSchema.parse({
        query,
        uploadDate: uploadDate || "any",
        duration: duration || "any",
        sortBy: sortBy || "relevance",
        maxResults: maxResults ? parseInt(maxResults as string, 10) : 25,
      });

      const result = await searchVideos(filters);
      res.json(result);
    } catch (error: any) {
      console.error("YouTube search error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Ungültige Suchparameter", details: error.errors });
      }
      const providerError = normalizeProviderError(error, "youtube");
      res.status(providerError.status).json(providerErrorPayload(providerError, "YouTube Data API"));
    }
  });

  app.post("/api/script/generate", rateLimit, async (req, res) => {
    try {
      const input = scriptInputSchema.parse(req.body);
      const result = await generateScript(input);
      res.json(result);
    } catch (error: any) {
      console.error("Script generation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Ungültige Skript-Eingabe", details: error.errors });
      }
      const friendly = getUserFriendlyError(error, "Skript-Generierung");
      res.status(500).json({ error: friendly.message, suggestion: friendly.suggestion });
    }
  });

  app.post("/api/script/extract-narration", rateLimit, async (req, res) => {
    try {
      const { scriptContent } = narrationExtractionRequestSchema.parse(req.body);
      const narration = await extractNarrationText(scriptContent);
      res.json({ narration });
    } catch (error: any) {
      console.error("Narration extraction error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Ungültige Anfrage zur Sprechtext-Extraktion", details: error.errors });
      }
      const friendly = getUserFriendlyError(error, "Sprechtext-Extraktion");
      res.status(500).json({ error: friendly.message, suggestion: friendly.suggestion });
    }
  });

  app.post("/api/ideas/generate", rateLimit, async (req, res) => {
    try {
      const parsed = ideaGenerationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Ungültige Anfrage für fundierte Ideen", details: parsed.error.errors });
      }

      const result = await generateIdeas(parsed.data);
      res.json(result);
    } catch (error: unknown) {
      console.error("Ideas generation error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Ideen"));
    }
  });

  app.post("/api/research/insights", rateLimit, async (req, res) => {
    try {
      const parsed = researchInsightsRequestSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: "Ein Suchbegriff und zwischen 1 und 50 gültige Videos sind erforderlich.",
          code: "RESEARCH_REQUEST_INVALID",
          details: parsed.error.errors,
        });
      }

      const result = await generateResearchInsights(parsed.data);
      res.json(result);
    } catch (error: unknown) {
      console.error("Research insights error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Recherche"));
    }
  });

  app.post("/api/script/regenerate-titles", rateLimit, async (req, res) => {
    try {
      const { topic, format, audience, evidenceContext } = titleRegenerationRequestSchema.parse(req.body);
      const titles = await regenerateTitles(
        topic,
        format,
        audience,
        evidenceContext,
      );
      res.json({ titles });
    } catch (error: any) {
      console.error("Title regeneration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Ungültige Anfrage zur Titel-Neugenerierung", details: error.errors });
      }
      const friendly = getUserFriendlyError(error, "Titel-Neugenerierung");
      res.status(500).json({ error: friendly.message, suggestion: friendly.suggestion });
    }
  });

  app.post("/api/script/regenerate-section", rateLimit, async (req, res) => {
    try {
      const parsed = sectionRegenerationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Ungültige Anfrage zur Abschnitts-Neugenerierung",
          code: "SCRIPT_SECTION_REGENERATION_REQUEST_INVALID",
          category: "invalid_response",
          retryable: false,
          suggestion: "Behalte den aktuellen Abschnitt bei und prüfe Thema, Format, Zielgruppe und Evidenz-Kontext.",
          details: parsed.error.flatten(),
        });
      }

      const result = await regenerateSection(parsed.data);
      res.json(result);
    } catch (error: unknown) {
      console.error("Section regeneration error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Abschnitts-Neugenerierung"));
    }
  });

  app.post("/api/script/regenerate-paragraph", rateLimit, async (req, res) => {
    try {
      const parsed = paragraphRegenerationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Ungültige Anfrage zur Absatz-Neugenerierung",
          code: "SCRIPT_PARAGRAPH_REGENERATION_REQUEST_INVALID",
          category: "invalid_response",
          retryable: false,
          suggestion: "Behalte den aktuellen Absatz bei und prüfe Abschnitt, Thema, Format, Zielgruppe und Evidenz-Kontext.",
          details: parsed.error.flatten(),
        });
      }

      const result = await regenerateParagraph(parsed.data);
      res.json(result);
    } catch (error: unknown) {
      console.error("Paragraph regeneration error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Absatz-Neugenerierung"));
    }
  });

  app.post("/api/thumbnail/generate", rateLimit, async (req, res) => {
    try {
      const parsed = thumbnailGenerationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Ungültige Anfrage zur Thumbnail-Generierung",
          code: "THUMBNAIL_REQUEST_INVALID",
          category: "invalid_response",
          retryable: false,
          suggestion: "Prüfe die Thumbnail-Felder und die Anforderungen an Referenzbilder und versuche es dann erneut.",
          details: parsed.error.flatten(),
        });
      }

      const { topic, ...config } = parsed.data;
      const result = await generateThumbnail(topic, config);
      res.json(result);
    } catch (error: unknown) {
      console.error("Thumbnail generation error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Bildgenerierung"));
    }
  });

  app.post("/api/thumbnail/suggestions", rateLimit, async (req, res) => {
    try {
      const parsed = thumbnailSuggestionsRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Ungültige Anfrage für Thumbnail-Vorschläge",
          code: "THUMBNAIL_SUGGESTIONS_REQUEST_INVALID",
          category: "invalid_response",
          retryable: false,
          suggestion: "Gib ein gültiges Thema an und kürze den mitgelieferten Ideen-Kontext.",
          details: parsed.error.flatten(),
        });
      }

      const suggestions = await generateThumbnailSuggestions(parsed.data);
      res.json({ suggestions });
    } catch (error: unknown) {
      console.error("Thumbnail suggestions error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Thumbnail-Vorschläge"));
    }
  });

  return httpServer;
}
