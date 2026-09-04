import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import type { SessionUser, UserRole } from "@shared/auth-contracts";
import { isDatabaseReady, query } from "./db";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// ---------- Passwörter ----------

const SCRYPT_PARAMS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  if (!Number.isFinite(cost) || cost < 1_024) return false;
  const salt = parts[2];
  const expected = Buffer.from(parts[3], "hex");
  if (expected.length !== 64) return false;
  const derived = await scrypt(password, salt, 64, { ...SCRYPT_PARAMS, N: cost });
  return timingSafeEqual(derived, expected);
}

// ---------- Sessions ----------

export const SESSION_COOKIE = "yp_session";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS || 24 * 30) * 60 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

function isSecureRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.get("x-forwarded-proto");
  return Boolean(proto && proto.split(",")[0].trim() === "https");
}

function cookieAttributes(req: Request, maxAgeSeconds: number): string {
  const attributes = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecureRequest(req)) attributes.push("Secure");
  return attributes.join("; ");
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieAttributes(req, Math.floor(SESSION_TTL_MS / 1000))}`,
  );
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; ${cookieAttributes(req, 0)}`);
}

export function getClientIp(req: Request): string | null {
  return req.ip || req.socket.remoteAddress || null;
}

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  active: boolean;
}

function toSessionUser(row: Pick<UserRow, "id" | "username" | "display_name" | "role">): SessionUser {
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role };
}

export async function createSession(req: Request, userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval, $4, $5)`,
    [hashToken(token), userId, String(SESSION_TTL_MS), getClientIp(req), (req.get("user-agent") || "").slice(0, 500)],
  );
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function destroyUserSessions(userId: number): Promise<void> {
  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

interface SessionLookupRow extends UserRow {
  last_seen_at: Date;
}

export async function resolveSession(token: string): Promise<SessionUser | null> {
  const tokenHash = hashToken(token);
  const result = await query<SessionLookupRow>(
    `SELECT u.id, u.username, u.display_name, u.password_hash, u.role, u.active, s.last_seen_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row || !row.active) return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > SESSION_TOUCH_INTERVAL_MS) {
    // Gleitende Ablaufzeit: aktive Nutzer bleiben angemeldet.
    query(
      `UPDATE sessions SET last_seen_at = now(), expires_at = now() + ($2 || ' milliseconds')::interval WHERE token_hash = $1`,
      [tokenHash, String(SESSION_TTL_MS)],
    ).catch(() => undefined);
  }
  return toSessionUser(row);
}

export async function cleanupExpiredSessions(): Promise<void> {
  await query("DELETE FROM sessions WHERE expires_at <= now()").catch(() => undefined);
}

// ---------- Benutzer ----------

export async function findUserForLogin(username: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    "SELECT id, username, display_name, password_hash, role, active FROM users WHERE lower(username) = lower($1)",
    [username],
  );
  return result.rows[0] ?? null;
}

export async function getPasswordHash(userId: number): Promise<string | null> {
  const result = await query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.password_hash ?? null;
}

export async function updatePassword(userId: number, password: string): Promise<void> {
  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, await hashPassword(password)]);
}

// Legt den ersten Admin aus ADMIN_USER/ADMIN_PASSWORD an, wenn noch keine
// Benutzer existieren. Danach werden Benutzer nur noch im Admin-Bereich verwaltet.
export async function bootstrapAdmin(log: (message: string) => void): Promise<void> {
  const count = await query<{ count: string }>("SELECT count(*)::text AS count FROM users");
  if (Number(count.rows[0]?.count || 0) > 0) return;

  const username = process.env.ADMIN_USER?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    log(
      "Noch keine Benutzer vorhanden. Setze ADMIN_USER und ADMIN_PASSWORD (mindestens 8 Zeichen), damit der erste Admin beim Start angelegt wird.",
    );
    return;
  }
  if (password.length < 8) {
    log("ADMIN_PASSWORD ist zu kurz (mindestens 8 Zeichen). Der erste Admin wurde nicht angelegt.");
    return;
  }
  await query(
    "INSERT INTO users (username, display_name, password_hash, role) VALUES ($1, $2, $3, 'admin')",
    [username, process.env.ADMIN_DISPLAY_NAME?.trim() || username, await hashPassword(password)],
  );
  log(`Erster Admin "${username}" wurde angelegt.`);
}

// ---------- Middleware ----------

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionToken?: string;
    }
  }
}

export function databaseUnavailablePayload() {
  return {
    error: "Die Datenbank ist nicht erreichbar. Login und Benutzerverwaltung sind vorübergehend nicht verfügbar.",
    code: "DATABASE_UNAVAILABLE",
  };
}

// Liest die Session aus dem Cookie und hängt req.user an. Blockiert nicht.
export async function attachSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!isDatabaseReady()) return next();
  const token = parseCookies(req.get("cookie"))[SESSION_COOKIE];
  if (!token || token.length > 200) return next();
  try {
    const user = await resolveSession(token);
    if (user) {
      req.user = user;
      req.sessionToken = token;
    }
  } catch (error: any) {
    console.error("Session lookup failed:", error?.message || error);
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isDatabaseReady()) {
    res.status(503).json(databaseUnavailablePayload());
    return;
  }
  if (!req.user) {
    res.setHeader("Cache-Control", "no-store");
    res.status(401).json({ error: "Anmeldung erforderlich.", code: "AUTH_REQUIRED" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Nur Administratoren dürfen diesen Bereich verwenden.", code: "FORBIDDEN" });
      return;
    }
    next();
  });
}

// Schutz gegen Cross-Site-Anfragen für verändernde Methoden: Wenn ein Origin
// gesendet wird, muss er zum Host passen. SameSite=Lax deckt den Rest ab.
export function rejectCrossOriginMutations(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  const host = req.get("x-forwarded-host")?.split(",")[0].trim() || req.get("host");
  try {
    if (host && new URL(origin).host === host) return next();
  } catch {
    // ungültiger Origin fällt durch
  }
  res.status(403).json({ error: "Anfrage von fremdem Ursprung abgelehnt.", code: "CROSS_ORIGIN" });
}
