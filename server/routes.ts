import type { Express } from "express";
import { createServer, type Server } from "http";
import { searchVideos } from "./youtube";
import { generateScript, generateIdeas, generateResearchInsights, regenerateTitles, regenerateSection, regenerateParagraph, generateThumbnail, generateThumbnailSuggestions, extractNarrationText } from "./gemini";
import { ideaGenerationRequestSchema, researchInsightsRequestSchema, searchFiltersSchema, scriptInputSchema } from "@shared/schema";
import { z } from "zod";
import { apiKeySettingsSchema, getApiKeyStatus, saveApiKeySettings } from "./settings";
import { requireAdmin } from "./auth";
import { startActivity, truncate } from "./activity";
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Einstellungen sind Administratoren vorbehalten. Gespeicherte Schlüssel
  // werden nie an den Browser zurückgegeben.
  app.get("/api/settings/status", requireAdmin, (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json(getApiKeyStatus());
  });

  app.put("/api/settings/api-keys", requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const activity = startActivity(req, res, "settings.save", () => "Einstellungen speichern");

    try {
      const input = apiKeySettingsSchema.parse(req.body);
      const status = await saveApiKeySettings(input);
      void activity.success(() => ({
        summary: [
          input.youtubeApiKey ? "YouTube-Schlüssel ersetzt" : null,
          input.geminiApiKey ? "Gemini-Schlüssel ersetzt" : null,
          input.geminiTextModel ? `Textmodell: ${input.geminiTextModel}` : null,
          input.geminiImageModel ? `Bildmodell: ${input.geminiImageModel}` : null,
        ].filter(Boolean).join(", "),
        details: { textModel: status.models.text, imageModel: status.models.image },
      }));
      return res.json({ success: true, status });
    } catch (error: any) {
      return res.status(400).json({
        error: error?.message || "API-Einstellungen konnten nicht gespeichert werden.",
      });
    }
  });

  app.get("/api/youtube/search", rateLimit, async (req, res) => {
    const activity = startActivity(req, res, "research.search", () => `Suche "${truncate(req.query.query, 120)}"`);
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
      void activity.success(() => ({
        summary: `Suche "${filters.query}" (${result.videos.length} Videos)`,
        details: { filters, snapshotId: result.snapshotId, totalResults: result.totalResults, warnings: result.warnings.length },
        content: {
          kind: "research_snapshot",
          title: `Recherche: ${filters.query}`,
          payload: {
            query: filters.query,
            filters,
            snapshotId: result.snapshotId,
            retrievedAt: result.retrievedAt,
            totalResults: result.totalResults,
            warnings: result.warnings,
            videos: result.videos.map((video) => ({
              id: video.id,
              title: video.title,
              channelTitle: video.channelTitle,
              viewCount: video.viewCount,
              likeCount: video.likeCount,
              commentCount: video.commentCount,
              publishedAt: video.publishedAt,
              duration: video.duration,
              url: `https://www.youtube.com/watch?v=${video.id}`,
              thumbnailUrl: video.thumbnailUrl,
            })),
          },
        },
      }));
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
    const activity = startActivity(req, res, "script.generate", () => `Skript zu "${truncate(req.body?.topic, 120)}"`);
    try {
      const input = scriptInputSchema.parse(req.body);
      const result = await generateScript(input);
      res.json(result);
      void activity.success(() => ({
        summary: `Skript zu "${truncate(input.topic, 120)}" (${input.format}, ${result.script.split(/\s+/).length} Wörter)`,
        details: { format: input.format, audience: input.audience, persona: input.persona, titles: result.titles },
        content: {
          kind: "script",
          title: result.titles?.[0] || input.topic,
          payload: {
            topic: input.topic,
            format: input.format,
            audience: input.audience,
            persona: input.persona,
            additionalNotes: input.additionalNotes,
            titles: result.titles,
            hook: result.hook,
            script: result.script,
            payoff: result.payoff,
            primaryCta: result.primaryCta,
            studioValidation: result.studioValidation,
          },
        },
      }));
    } catch (error: any) {
      console.error("Script generation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Ungültige Skript-Eingabe", details: error.errors });
      }
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Skript-Generierung"));
    }
  });

  app.post("/api/script/extract-narration", rateLimit, async (req, res) => {
    const activity = startActivity(req, res, "script.extract_narration", () => "Sprechtext extrahieren");
    try {
      const { scriptContent } = narrationExtractionRequestSchema.parse(req.body);
      const narration = await extractNarrationText(scriptContent);
      res.json({ narration });
      void activity.success(() => ({
        summary: `Sprechtext extrahiert (${narration.split(/\s+/).length} Wörter)`,
        content: { kind: "narration", title: `Sprechtext: ${truncate(narration, 60)}`, payload: { narration } },
      }));
    } catch (error: any) {
      console.error("Narration extraction error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Ungültige Anfrage zur Sprechtext-Extraktion", details: error.errors });
      }
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Sprechtext-Extraktion"));
    }
  });

  app.post("/api/ideas/generate", rateLimit, async (req, res) => {
    const activity = startActivity(req, res, "ideas.generate", () => `Ideen zu "${truncate(req.body?.niche, 100)}"`);
    try {
      const parsed = ideaGenerationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Ungültige Anfrage für fundierte Ideen", details: parsed.error.errors });
      }

      const result = await generateIdeas(parsed.data);
      res.json(result);
      void activity.success(() => ({
        summary: `${result.ideas.length} Ideen zu "${truncate(parsed.data.niche, 100)}"`,
        details: { niche: parsed.data.niche, keywords: parsed.data.keywords, titles: result.ideas.map((idea) => idea.title) },
        content: { kind: "ideas", title: `Ideen: ${truncate(parsed.data.niche, 80)}`, payload: { niche: parsed.data.niche, ideas: result.ideas } },
      }));
    } catch (error: unknown) {
      console.error("Ideas generation error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Ideen"));
    }
  });

  app.post("/api/research/insights", rateLimit, async (req, res) => {
    const activity = startActivity(req, res, "research.insights", () => `KI-Insights zu "${truncate(req.body?.query, 100)}"`);
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
      void activity.success(() => ({
        summary: `KI-Insights zu "${truncate(parsed.data.query, 100)}" (${parsed.data.videos.length} Videos)`,
        details: { query: parsed.data.query, snapshotId: parsed.data.snapshotId, videos: parsed.data.videos.length },
        content: { kind: "research_insights", title: `KI-Insights: ${truncate(parsed.data.query, 80)}`, payload: { query: parsed.data.query, ...result } },
      }));
    } catch (error: unknown) {
      console.error("Research insights error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Recherche"));
    }
  });

  app.post("/api/script/regenerate-titles", rateLimit, async (req, res) => {
    const activity = startActivity(req, res, "script.regenerate_titles", () => `Titel zu "${truncate(req.body?.topic, 100)}"`);
    try {
      const { topic, format, audience, evidenceContext } = titleRegenerationRequestSchema.parse(req.body);
      const titles = await regenerateTitles(
        topic,
        format,
        audience,
        evidenceContext,
      );
      res.json({ titles });
      void activity.success(() => ({
        summary: `${titles.length} Titel zu "${truncate(topic, 100)}"`,
        content: { kind: "script_titles", title: `Titel: ${truncate(topic, 80)}`, payload: { topic, format, audience, titles } },
      }));
    } catch (error: any) {
      console.error("Title regeneration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Ungültige Anfrage zur Titel-Neugenerierung", details: error.errors });
      }
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Titel-Neugenerierung"));
    }
  });

  app.post("/api/script/regenerate-section", rateLimit, async (req, res) => {
    const activity = startActivity(req, res, "script.regenerate_section", () => `Abschnitt "${truncate(req.body?.sectionName, 60)}"`);
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
      void activity.success(() => ({
        summary: `Abschnitt "${truncate(parsed.data.sectionName, 60)}" zu "${truncate(parsed.data.topic, 80)}" neu generiert`,
        content: {
          kind: "script_section",
          title: `Abschnitt: ${truncate(parsed.data.sectionName, 60)}`,
          payload: { topic: parsed.data.topic, sectionName: parsed.data.sectionName, before: parsed.data.sectionContent, after: result.content },
        },
      }));
    } catch (error: unknown) {
      console.error("Section regeneration error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Abschnitts-Neugenerierung"));
    }
  });

  app.post("/api/script/regenerate-paragraph", rateLimit, async (req, res) => {
    const activity = startActivity(req, res, "script.regenerate_paragraph", () => `Absatz in "${truncate(req.body?.sectionName, 60)}"`);
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
      void activity.success(() => ({
        summary: `Absatz in "${truncate(parsed.data.sectionName, 60)}" zu "${truncate(parsed.data.topic, 80)}" neu generiert`,
        content: {
          kind: "script_paragraph",
          title: `Absatz: ${truncate(parsed.data.paragraphContent, 60)}`,
          payload: { topic: parsed.data.topic, sectionName: parsed.data.sectionName, before: parsed.data.paragraphContent, after: result.content },
        },
      }));
    } catch (error: unknown) {
      console.error("Paragraph regeneration error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Absatz-Neugenerierung"));
    }
  });

  app.post("/api/thumbnail/generate", rateLimit, async (req, res) => {
    const activity = startActivity(req, res, "thumbnail.generate", () => `Thumbnail zu "${truncate(req.body?.topic, 100)}"`);
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
      void activity.success(() => ({
        summary: `Thumbnail zu "${truncate(topic, 100)}" (${result.model}${config.mode === "variation" ? ", Variante" : ""})`,
        details: { model: result.model, style: config.style, mode: config.mode, references: config.referenceImages.length, mainText: config.mainText, subText: config.subText },
        content: {
          kind: "thumbnail",
          title: `Thumbnail: ${truncate(config.mainText || topic, 80)}`,
          payload: {
            topic,
            mainText: config.mainText,
            subText: config.subText,
            style: config.style,
            composition: config.composition,
            colorScheme: config.colorScheme,
            mode: config.mode,
            model: result.model,
            prompt: result.prompt,
            image: result.imageData,
          },
        },
      }));
    } catch (error: unknown) {
      console.error("Thumbnail generation error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Bildgenerierung"));
    }
  });

  app.post("/api/thumbnail/suggestions", rateLimit, async (req, res) => {
    const activity = startActivity(req, res, "thumbnail.suggestions", () => `Thumbnail-Text zu "${truncate(req.body?.topic, 100)}"`);
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
      void activity.success(() => ({
        summary: `${suggestions.length} Thumbnail-Textvorschläge zu "${truncate(parsed.data.topic, 100)}"`,
        content: { kind: "thumbnail_suggestions", title: `Thumbnail-Text: ${truncate(parsed.data.topic, 80)}`, payload: { topic: parsed.data.topic, suggestions } },
      }));
    } catch (error: unknown) {
      console.error("Thumbnail suggestions error:", error);
      const providerError = normalizeProviderError(error, "gemini");
      res.status(providerError.status).json(providerErrorPayload(providerError, "Gemini-Thumbnail-Vorschläge"));
    }
  });

  return httpServer;
}
