import type { Express } from "express";
import { z } from "zod";
import {
  workflowIdSchema,
  workflowUpsertSchema,
  type AdminWorkflowDetailResponse,
  type AdminWorkflowListResponse,
  type AdminWorkflowSummary,
  type WorkflowRecordPayload,
} from "@shared/auth-contracts";
import { WORKFLOW_HISTORY_LIMIT, type WorkflowHistorySummary } from "@shared/workflow-history";
import { requireAdmin, requireAuth } from "./auth";
import { query } from "./db";

// Workflows werden pro Benutzer serverseitig gespeichert. Benutzer sehen nur
// ihre eigenen Workflows. Löschen ist ein Soft-Delete, damit Admins auch
// entfernte Workflows weiterhin einsehen können.

interface WorkflowRow {
  id: string;
  user_id: number;
  title: string;
  current_step: WorkflowHistorySummary["currentStep"];
  has_research: boolean;
  has_script: boolean;
  has_thumbnail: boolean;
  research_query: string | null;
  video_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: Date | null;
  username?: string;
  display_name?: string;
}

function toSummary(row: WorkflowRow): WorkflowHistorySummary {
  return {
    id: row.id,
    title: row.title,
    currentStep: row.current_step,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    hasResearch: row.has_research,
    hasScript: row.has_script,
    hasThumbnail: row.has_thumbnail,
  };
}

function toAdminSummary(row: WorkflowRow): AdminWorkflowSummary {
  return {
    ...toSummary(row),
    userId: row.user_id,
    username: row.username || "",
    displayName: row.display_name || "",
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    researchQuery: row.research_query,
    videoCount: row.video_count,
  };
}

const SUMMARY_COLUMNS = `w.id, w.user_id, w.title, w.current_step, w.has_research, w.has_script, w.has_thumbnail,
  w.research_query, w.video_count, w.created_at::text, w.updated_at::text, w.deleted_at`;

function extractResearchMeta(state: unknown): { query: string | null; videoCount: number } {
  const research = (state as any)?.cachedResearch;
  if (!research || typeof research !== "object") return { query: null, videoCount: 0 };
  const queryText = typeof research.query === "string" ? research.query.slice(0, 200) : null;
  const videoCount = Array.isArray(research.videos) ? research.videos.length : 0;
  return { query: queryText, videoCount };
}

function parseId(value: unknown): string | null {
  const parsed = workflowIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function registerWorkflowRoutes(app: Express): void {
  // ---------- Eigene Workflows ----------

  app.get("/api/workflows", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const result = await query<WorkflowRow>(
        `SELECT ${SUMMARY_COLUMNS} FROM workflows w
         WHERE w.user_id = $1 AND w.deleted_at IS NULL
         ORDER BY w.updated_at DESC LIMIT $2`,
        [req.user!.id, WORKFLOW_HISTORY_LIMIT],
      );
      return res.json({ workflows: result.rows.map(toSummary) });
    } catch (error: any) {
      console.error("Workflow list error:", error?.message || error);
      return res.status(500).json({ error: "Workflows konnten nicht geladen werden." });
    }
  });

  app.get("/api/workflows/:id", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Ungültige Workflow-ID." });
    try {
      const result = await query<{ id: string; created_at: string; updated_at: string; state: unknown }>(
        `SELECT id, created_at::text, updated_at::text, state FROM workflows
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [id, req.user!.id],
      );
      const row = result.rows[0];
      if (!row) return res.status(404).json({ error: "Workflow nicht gefunden." });
      const record: WorkflowRecordPayload = {
        id: row.id,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        state: row.state,
      };
      return res.json({ record });
    } catch (error: any) {
      console.error("Workflow load error:", error?.message || error);
      return res.status(500).json({ error: "Workflow konnte nicht geladen werden." });
    }
  });

  app.put("/api/workflows/:id", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Ungültige Workflow-ID." });
    const parsed = workflowUpsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ungültige Workflow-Daten.", details: parsed.error.flatten() });
    const { createdAt, updatedAt, state, summary } = parsed.data;
    const meta = extractResearchMeta(state);
    try {
      const owner = await query<{ user_id: number }>("SELECT user_id FROM workflows WHERE id = $1", [id]);
      if (owner.rows[0] && owner.rows[0].user_id !== req.user!.id) {
        return res.status(403).json({ error: "Dieser Workflow gehört einem anderen Benutzer." });
      }
      await query(
        `INSERT INTO workflows (id, user_id, title, current_step, has_research, has_script, has_thumbnail,
                                research_query, video_count, created_at, updated_at, deleted_at, state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, $12::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title, current_step = EXCLUDED.current_step,
           has_research = EXCLUDED.has_research, has_script = EXCLUDED.has_script, has_thumbnail = EXCLUDED.has_thumbnail,
           research_query = EXCLUDED.research_query, video_count = EXCLUDED.video_count,
           updated_at = EXCLUDED.updated_at, deleted_at = NULL, state = EXCLUDED.state`,
        [
          id, req.user!.id, summary.title, summary.currentStep, summary.hasResearch, summary.hasScript, summary.hasThumbnail,
          meta.query, meta.videoCount, createdAt, updatedAt, JSON.stringify(state ?? null),
        ],
      );
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Workflow save error:", error?.message || error);
      return res.status(500).json({ error: "Workflow konnte nicht gespeichert werden." });
    }
  });

  app.delete("/api/workflows/:id", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Ungültige Workflow-ID." });
    try {
      await query(
        "UPDATE workflows SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
        [id, req.user!.id],
      );
      return res.status(204).end();
    } catch (error: any) {
      console.error("Workflow delete error:", error?.message || error);
      return res.status(500).json({ error: "Workflow konnte nicht gelöscht werden." });
    }
  });

  // Entfernt die ältesten Workflows über dem Limit aus der Liste des Benutzers.
  app.post("/api/workflows/prune", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const result = await query<{ id: string }>(
        `UPDATE workflows SET deleted_at = now()
         WHERE user_id = $1 AND deleted_at IS NULL AND id IN (
           SELECT id FROM workflows WHERE user_id = $1 AND deleted_at IS NULL
           ORDER BY updated_at DESC OFFSET $2
         ) RETURNING id`,
        [req.user!.id, WORKFLOW_HISTORY_LIMIT],
      );
      return res.json({ removed: result.rows.map((row) => row.id) });
    } catch (error: any) {
      console.error("Workflow prune error:", error?.message || error);
      return res.status(500).json({ error: "Workflow-Liste konnte nicht bereinigt werden." });
    }
  });

  // ---------- Admin: alle Workflows ----------

  const adminListQuerySchema = z.object({
    userId: z.coerce.number().int().positive().optional(),
    includeDeleted: z.coerce.boolean().optional().default(true),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  });

  app.get("/api/admin/workflows", requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const parsed = adminListQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Ungültige Filter." });
    const { userId, includeDeleted, limit } = parsed.data;
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (userId) {
        params.push(userId);
        conditions.push(`w.user_id = $${params.length}`);
      }
      if (!includeDeleted) conditions.push("w.deleted_at IS NULL");
      params.push(limit);
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const result = await query<WorkflowRow>(
        `SELECT ${SUMMARY_COLUMNS}, u.username, u.display_name
         FROM workflows w JOIN users u ON u.id = w.user_id
         ${where} ORDER BY w.updated_at DESC LIMIT $${params.length}`,
        params,
      );
      const response: AdminWorkflowListResponse = { workflows: result.rows.map(toAdminSummary) };
      return res.json(response);
    } catch (error: any) {
      console.error("Admin workflow list error:", error?.message || error);
      return res.status(500).json({ error: "Workflows konnten nicht geladen werden." });
    }
  });

  app.get("/api/admin/workflows/:id", requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Ungültige Workflow-ID." });
    try {
      const result = await query<WorkflowRow & { state: unknown }>(
        `SELECT ${SUMMARY_COLUMNS}, w.state, u.username, u.display_name
         FROM workflows w JOIN users u ON u.id = w.user_id WHERE w.id = $1`,
        [id],
      );
      const row = result.rows[0];
      if (!row) return res.status(404).json({ error: "Workflow nicht gefunden." });
      const response: AdminWorkflowDetailResponse = { workflow: toAdminSummary(row), state: row.state };
      return res.json(response);
    } catch (error: any) {
      console.error("Admin workflow detail error:", error?.message || error);
      return res.status(500).json({ error: "Workflow konnte nicht geladen werden." });
    }
  });
}
