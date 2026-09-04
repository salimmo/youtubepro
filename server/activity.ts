import type { Request, Response } from "express";
import type { ActivityAction, ContentKind } from "@shared/auth-contracts";
import { isDatabaseReady, query } from "./db";
import { getClientIp } from "./auth";

// Aktivitätsprotokoll und Inhaltsspeicher. Fehler beim Protokollieren dürfen
// niemals die eigentliche Anfrage scheitern lassen, deshalb wird alles
// abgefangen und nur geloggt.

export interface ContentInput {
  kind: ContentKind;
  title: string;
  payload: unknown;
}

export interface ActivityInput {
  action: ActivityAction;
  summary?: string;
  status?: number;
  durationMs?: number;
  details?: Record<string, unknown> | null;
  content?: ContentInput | null;
  userId?: number | null;
}

const MAX_SUMMARY = 500;
const MAX_TITLE = 200;

export function truncate(value: unknown, max: number): string {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

export async function recordActivity(req: Request | null, input: ActivityInput): Promise<number | null> {
  if (!isDatabaseReady()) return null;
  const userId = input.userId !== undefined ? input.userId : req?.user?.id ?? null;
  try {
    let contentId: number | null = null;
    if (input.content) {
      const content = await query<{ id: number }>(
        "INSERT INTO contents (user_id, kind, title, payload) VALUES ($1, $2, $3, $4::jsonb) RETURNING id",
        [userId, input.content.kind, truncate(input.content.title, MAX_TITLE) || input.content.kind, JSON.stringify(input.content.payload ?? null)],
      );
      contentId = content.rows[0]?.id ?? null;
    }
    const activity = await query<{ id: string }>(
      `INSERT INTO activity_log (user_id, action, summary, status, duration_ms, ip, details, content_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) RETURNING id::text`,
      [
        userId,
        input.action,
        truncate(input.summary, MAX_SUMMARY),
        input.status ?? 200,
        Math.max(0, Math.round(input.durationMs ?? 0)),
        req ? getClientIp(req) : null,
        input.details ? JSON.stringify(input.details) : null,
        contentId,
      ],
    );
    const activityId = Number(activity.rows[0]?.id);
    if (contentId && Number.isFinite(activityId)) {
      await query("UPDATE contents SET activity_id = $2 WHERE id = $1", [contentId, activityId]);
    }
    return Number.isFinite(activityId) ? activityId : null;
  } catch (error: any) {
    console.error("Activity logging failed:", error?.message || error);
    return null;
  }
}

// Hilfsfunktion für Routen: misst die Dauer, protokolliert Erfolg explizit
// über `success()` und Fehler automatisch, sobald die Antwort mit Status >= 400
// abgeschlossen wurde. So bleiben die catch-Blöcke der Routen unverändert.
export function startActivity(
  req: Request,
  res: Response,
  action: ActivityAction,
  failureSummary: () => string,
) {
  const startedAt = Date.now();
  let recorded = false;
  res.on("finish", () => {
    if (recorded || res.statusCode < 400) return;
    recorded = true;
    let summary = "";
    try {
      summary = failureSummary();
    } catch {
      summary = "";
    }
    void recordActivity(req, {
      action,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      summary: summary ? `Fehlgeschlagen: ${summary}` : "Fehlgeschlagen",
    });
  });
  return {
    async success(describe: () => Omit<ActivityInput, "action" | "status" | "durationMs">): Promise<void> {
      if (recorded) return;
      recorded = true;
      let described: Omit<ActivityInput, "action" | "status" | "durationMs"> = {};
      try {
        described = describe();
      } catch (error: any) {
        console.error("Activity description failed:", error?.message || error);
      }
      await recordActivity(req, { action, status: 200, durationMs: Date.now() - startedAt, ...described });
    },
  };
}
