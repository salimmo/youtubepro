import type { Express, Request } from "express";
import { z } from "zod";
import {
  activityListQuerySchema,
  adminCreateUserSchema,
  adminUpdateUserSchema,
  changePasswordRequestSchema,
  loginRequestSchema,
  type ActivityEntry,
  type ActivityListResponse,
  type AdminStats,
  type AdminUser,
  type ContentRecord,
} from "@shared/auth-contracts";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  destroyUserSessions,
  findUserForLogin,
  getPasswordHash,
  hashPassword,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  updatePassword,
  verifyPassword,
  databaseUnavailablePayload,
} from "./auth";
import { isDatabaseReady, query } from "./db";
import { recordActivity } from "./activity";
import { createRateLimiter } from "./rate-limit";

// Login-Versuche pro Adresse begrenzen (Brute-Force-Schutz).
const { middleware: loginRateLimit } = createRateLimiter({ maxRequests: 10, windowMs: 10 * 60_000 });

function zodMessage(error: z.ZodError): string {
  return error.errors[0]?.message || "Ungültige Eingabe.";
}

interface AdminUserRow {
  id: number;
  username: string;
  display_name: string;
  role: "admin" | "user";
  active: boolean;
  created_at: Date;
  last_login_at: Date | null;
  activity_count: string;
}

function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
    createdAt: new Date(row.created_at).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    activityCount: Number(row.activity_count || 0),
  };
}

const ADMIN_USER_SELECT = `
  SELECT u.id, u.username, u.display_name, u.role, u.active, u.created_at, u.last_login_at,
         (SELECT count(*) FROM activity_log a WHERE a.user_id = u.id)::text AS activity_count
  FROM users u`;

async function loadAdminUser(id: number): Promise<AdminUser | null> {
  const result = await query<AdminUserRow>(`${ADMIN_USER_SELECT} WHERE u.id = $1`, [id]);
  return result.rows[0] ? toAdminUser(result.rows[0]) : null;
}

interface ActivityRow {
  id: string;
  user_id: number | null;
  username: string | null;
  display_name: string | null;
  action: ActivityEntry["action"];
  summary: string;
  status: number;
  duration_ms: number;
  ip: string | null;
  created_at: Date;
  details: Record<string, unknown> | null;
  content_id: number | null;
  content_kind: ActivityEntry["contentKind"];
}

function toActivityEntry(row: ActivityRow): ActivityEntry {
  return {
    id: Number(row.id),
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    action: row.action,
    summary: row.summary,
    status: row.status,
    durationMs: row.duration_ms,
    ip: row.ip,
    createdAt: new Date(row.created_at).toISOString(),
    details: row.details,
    contentId: row.content_id,
    contentKind: row.content_kind,
  };
}

export function registerAuthRoutes(app: Express): void {
  // ---------- Login / Logout / Ich ----------

  app.post("/api/auth/login", loginRateLimit, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!isDatabaseReady()) return res.status(503).json(databaseUnavailablePayload());
    const parsed = loginRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });

    const startedAt = Date.now();
    try {
      const user = await findUserForLogin(parsed.data.username);
      const valid = user ? await verifyPassword(parsed.data.password, user.password_hash) : false;
      if (!user || !valid || !user.active) {
        await recordActivity(req, {
          action: "auth.login_failed",
          status: 401,
          durationMs: Date.now() - startedAt,
          summary: `Fehlgeschlagene Anmeldung für "${parsed.data.username.slice(0, 40)}"${user && !user.active ? " (Konto deaktiviert)" : ""}`,
          userId: user?.id ?? null,
        });
        return res.status(401).json({ error: "Benutzername oder Passwort ist falsch." });
      }

      const token = await createSession(req, user.id);
      setSessionCookie(req, res, token);
      const sessionUser = { id: user.id, username: user.username, displayName: user.display_name, role: user.role };
      req.user = sessionUser;
      await recordActivity(req, { action: "auth.login", durationMs: Date.now() - startedAt, summary: "Angemeldet" });
      return res.json({ user: sessionUser });
    } catch (error: any) {
      console.error("Login error:", error?.message || error);
      return res.status(500).json({ error: "Anmeldung derzeit nicht möglich." });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.sessionToken) {
      await destroySession(req.sessionToken).catch(() => undefined);
      await recordActivity(req, { action: "auth.logout", summary: "Abgemeldet" });
    }
    clearSessionCookie(req, res);
    return res.status(204).end();
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ user: req.user });
  });

  app.post("/api/auth/password", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const parsed = changePasswordRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const user = req.user!;
    try {
      const currentHash = await getPasswordHash(user.id);
      if (!currentHash || !(await verifyPassword(parsed.data.currentPassword, currentHash))) {
        return res.status(400).json({ error: "Das aktuelle Passwort ist falsch." });
      }
      await updatePassword(user.id, parsed.data.newPassword);
      await recordActivity(req, { action: "auth.password_changed", summary: "Eigenes Passwort geändert" });
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Password change error:", error?.message || error);
      return res.status(500).json({ error: "Passwort konnte nicht geändert werden." });
    }
  });

  // ---------- Admin: Statistik ----------

  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const totals = await query<{ users: string; active_users: string; activities: string; activities_24h: string; contents: string }>(`
        SELECT (SELECT count(*) FROM users)::text AS users,
               (SELECT count(*) FROM users WHERE active)::text AS active_users,
               (SELECT count(*) FROM activity_log)::text AS activities,
               (SELECT count(*) FROM activity_log WHERE created_at > now() - interval '24 hours')::text AS activities_24h,
               (SELECT count(*) FROM contents)::text AS contents`);
      const perUser = await query<{ id: number; username: string; display_name: string; role: "admin" | "user"; activities: string; last_activity_at: Date | null }>(`
        SELECT u.id, u.username, u.display_name, u.role,
               (SELECT count(*) FROM activity_log a WHERE a.user_id = u.id)::text AS activities,
               (SELECT max(created_at) FROM activity_log a WHERE a.user_id = u.id) AS last_activity_at
        FROM users u ORDER BY u.created_at ASC`);
      const row = totals.rows[0];
      const stats: AdminStats = {
        users: Number(row?.users || 0),
        activeUsers: Number(row?.active_users || 0),
        activitiesTotal: Number(row?.activities || 0),
        activitiesLast24h: Number(row?.activities_24h || 0),
        contents: Number(row?.contents || 0),
        perUser: perUser.rows.map((user) => ({
          userId: user.id,
          username: user.username,
          displayName: user.display_name,
          role: user.role,
          activities: Number(user.activities || 0),
          lastActivityAt: user.last_activity_at ? new Date(user.last_activity_at).toISOString() : null,
        })),
      };
      return res.json(stats);
    } catch (error: any) {
      console.error("Admin stats error:", error?.message || error);
      return res.status(500).json({ error: "Statistik konnte nicht geladen werden." });
    }
  });

  // ---------- Admin: Benutzer ----------

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const result = await query<AdminUserRow>(`${ADMIN_USER_SELECT} ORDER BY u.created_at ASC`);
      return res.json({ users: result.rows.map(toAdminUser) });
    } catch (error: any) {
      console.error("Admin users error:", error?.message || error);
      return res.status(500).json({ error: "Benutzer konnten nicht geladen werden." });
    }
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const parsed = adminCreateUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    try {
      const existing = await query("SELECT 1 FROM users WHERE lower(username) = lower($1)", [parsed.data.username]);
      if (existing.rowCount) return res.status(409).json({ error: "Dieser Benutzername ist bereits vergeben." });
      const inserted = await query<{ id: number }>(
        "INSERT INTO users (username, display_name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
        [parsed.data.username, parsed.data.displayName, await hashPassword(parsed.data.password), parsed.data.role],
      );
      const user = await loadAdminUser(inserted.rows[0].id);
      await recordActivity(req, {
        action: "admin.user_create",
        summary: `Benutzer "${parsed.data.username}" (${parsed.data.role}) angelegt`,
        details: { targetUserId: inserted.rows[0].id, role: parsed.data.role },
      });
      return res.status(201).json({ user });
    } catch (error: any) {
      console.error("Admin create user error:", error?.message || error);
      return res.status(500).json({ error: "Benutzer konnte nicht angelegt werden." });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Ungültige Benutzer-ID." });
    const parsed = adminUpdateUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const changes = parsed.data;
    if (Object.keys(changes).length === 0) return res.status(400).json({ error: "Keine Änderungen übergeben." });

    if (id === req.user!.id) {
      if (changes.active === false) return res.status(400).json({ error: "Du kannst dein eigenes Konto nicht deaktivieren." });
      if (changes.role === "user") return res.status(400).json({ error: "Du kannst dir selbst die Admin-Rolle nicht entziehen." });
    }

    try {
      const current = await loadAdminUser(id);
      if (!current) return res.status(404).json({ error: "Benutzer nicht gefunden." });

      const updates: string[] = [];
      const params: unknown[] = [id];
      const changed: string[] = [];
      if (changes.displayName !== undefined) {
        params.push(changes.displayName);
        updates.push(`display_name = $${params.length}`);
        changed.push("Anzeigename");
      }
      if (changes.role !== undefined) {
        params.push(changes.role);
        updates.push(`role = $${params.length}`);
        changed.push(`Rolle → ${changes.role}`);
      }
      if (changes.active !== undefined) {
        params.push(changes.active);
        updates.push(`active = $${params.length}`);
        changed.push(changes.active ? "aktiviert" : "deaktiviert");
      }
      if (changes.password !== undefined) {
        params.push(await hashPassword(changes.password));
        updates.push(`password_hash = $${params.length}`);
        changed.push("Passwort zurückgesetzt");
      }
      await query(`UPDATE users SET ${updates.join(", ")} WHERE id = $1`, params);
      if (changes.active === false || changes.password !== undefined) {
        await destroyUserSessions(id);
      }
      const user = await loadAdminUser(id);
      await recordActivity(req, {
        action: "admin.user_update",
        summary: `Benutzer "${current.username}": ${changed.join(", ")}`,
        details: { targetUserId: id, changed },
      });
      return res.json({ user });
    } catch (error: any) {
      console.error("Admin update user error:", error?.message || error);
      return res.status(500).json({ error: "Benutzer konnte nicht geändert werden." });
    }
  });

  // ---------- Admin: Aktivitäten und Inhalte ----------

  app.get("/api/admin/activity", requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const parsed = activityListQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const { userId, action, before, limit } = parsed.data;
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (userId) {
        params.push(userId);
        conditions.push(`a.user_id = $${params.length}`);
      }
      if (action) {
        params.push(action);
        conditions.push(`a.action = $${params.length}`);
      }
      if (before) {
        params.push(before);
        conditions.push(`a.id < $${params.length}`);
      }
      params.push(limit + 1);
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const result = await query<ActivityRow>(
        `SELECT a.id::text, a.user_id, u.username, u.display_name, a.action, a.summary, a.status, a.duration_ms,
                a.ip, a.created_at, a.details, a.content_id, c.kind AS content_kind
         FROM activity_log a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN contents c ON c.id = a.content_id
         ${where}
         ORDER BY a.id DESC
         LIMIT $${params.length}`,
        params,
      );
      const rows = result.rows.slice(0, limit);
      const hasMore = result.rows.length > limit;
      const response: ActivityListResponse = {
        entries: rows.map(toActivityEntry),
        nextBefore: hasMore && rows.length ? Number(rows[rows.length - 1].id) : null,
      };
      return res.json(response);
    } catch (error: any) {
      console.error("Admin activity error:", error?.message || error);
      return res.status(500).json({ error: "Aktivitäten konnten nicht geladen werden." });
    }
  });

  app.get("/api/admin/contents/:id", requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Ungültige Inhalts-ID." });
    try {
      const result = await query<{
        id: number; activity_id: string | null; user_id: number | null; username: string | null;
        kind: ContentRecord["kind"]; title: string; created_at: Date; payload: unknown;
      }>(
        `SELECT c.id, c.activity_id::text, c.user_id, u.username, c.kind, c.title, c.created_at, c.payload
         FROM contents c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = $1`,
        [id],
      );
      const row = result.rows[0];
      if (!row) return res.status(404).json({ error: "Inhalt nicht gefunden." });
      const content: ContentRecord = {
        id: row.id,
        activityId: row.activity_id ? Number(row.activity_id) : null,
        userId: row.user_id,
        username: row.username,
        kind: row.kind,
        title: row.title,
        createdAt: new Date(row.created_at).toISOString(),
        payload: row.payload,
      };
      return res.json({ content });
    } catch (error: any) {
      console.error("Admin content error:", error?.message || error);
      return res.status(500).json({ error: "Inhalt konnte nicht geladen werden." });
    }
  });
}

export function summarizeRequestUser(req: Request): string {
  return req.user ? `${req.user.displayName} (${req.user.username})` : "anonym";
}
