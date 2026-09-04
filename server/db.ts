import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

// PostgreSQL-Anbindung. DATABASE_URL kommt aus Coolify (oder lokal aus .env),
// z. B. postgres://user:pass@host:5432/youtubepro. Ohne DATABASE_URL startet
// der Server, aber Login und Tracking sind nicht verfügbar.

let pool: Pool | null = null;
let ready = false;
let lastError: string | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function isDatabaseReady(): boolean {
  return ready;
}

export function getDatabaseError(): string | null {
  return lastError;
}

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL ist nicht gesetzt.");
  }
  const sslMode = process.env.DATABASE_SSL?.trim().toLowerCase();
  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: sslMode === "true" || sslMode === "require" ? { rejectUnauthorized: false } : undefined,
  });
  pool.on("error", (error) => {
    lastError = error.message;
    console.error("PostgreSQL pool error:", error.message);
  });
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as any[]);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// Schema-Migrationen. Idempotent, laufen bei jedem Start.
const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    ip TEXT,
    user_agent TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at)`,
  `CREATE TABLE IF NOT EXISTS contents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS contents_user_id_idx ON contents(user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS activity_log (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    status INTEGER NOT NULL DEFAULT 200,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    ip TEXT,
    details JSONB,
    content_id INTEGER REFERENCES contents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS activity_log_user_id_idx ON activity_log(user_id, id DESC)`,
  `CREATE INDEX IF NOT EXISTS activity_log_action_idx ON activity_log(action, id DESC)`,
  `CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON activity_log(created_at DESC)`,
  `ALTER TABLE contents ADD COLUMN IF NOT EXISTS activity_id BIGINT`,
];

export async function migrate(): Promise<void> {
  for (const statement of MIGRATIONS) {
    await query(statement);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Startet die Datenbank mit Wiederholungen. Coolify startet App und Datenbank
// oft gleichzeitig, deshalb darf der erste Verbindungsversuch fehlschlagen.
export async function initializeDatabase(options: {
  onReady?: () => Promise<void> | void;
  log?: (message: string) => void;
} = {}): Promise<boolean> {
  const log = options.log ?? ((message: string) => console.log(message));
  if (!isDatabaseConfigured()) {
    lastError = "DATABASE_URL ist nicht gesetzt.";
    log("DATABASE_URL ist nicht gesetzt. Login, Benutzerverwaltung und Tracking sind deaktiviert.");
    return false;
  }

  const maxAttempts = Number(process.env.DATABASE_CONNECT_ATTEMPTS || 30);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await migrate();
      ready = true;
      lastError = null;
      log("PostgreSQL verbunden, Schema aktuell.");
      if (options.onReady) await options.onReady();
      return true;
    } catch (error: any) {
      lastError = error?.message || String(error);
      log(`PostgreSQL nicht erreichbar (Versuch ${attempt}/${maxAttempts}): ${lastError}`);
      if (attempt < maxAttempts) await sleep(Math.min(2_000 * attempt, 10_000));
    }
  }
  return false;
}

export async function closeDatabase(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = null;
  ready = false;
  await current.end().catch(() => undefined);
}
