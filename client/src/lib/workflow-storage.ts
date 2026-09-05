import type { WorkflowHistorySummary } from "@shared/workflow-history";
import type { WorkflowRecordPayload, WorkflowSummaryPayload } from "@shared/auth-contracts";

// Workflow-Speicher: Workflows liegen serverseitig pro Benutzer in PostgreSQL.
// Dadurch sieht jeder Benutzer nur seine eigenen Workflows, unabhängig vom
// Browser, und Admins können alle Workflows im Admin-Bereich einsehen.
//
// Die frühere IndexedDB-Ablage bleibt nur für die einmalige Übernahme alter
// Workflows erhalten (siehe readLegacyIndexedDbRecords / clearLegacyIndexedDb).

export type StoredWorkflowRecord<T> = WorkflowRecordPayload<T>;

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (response.status === 401) {
    window.dispatchEvent(new Event("yp:unauthorized"));
    throw new Error("Anmeldung erforderlich.");
  }
  if (response.status === 404) {
    throw new WorkflowNotFoundError();
  }
  if (!response.ok) {
    let message = `Workflow-Speicher antwortete mit Status ${response.status}.`;
    try {
      const data = await response.json();
      if (data?.error) message = String(data.error);
    } catch {
      // Antwort ohne JSON-Body
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export class WorkflowNotFoundError extends Error {
  constructor() {
    super("Workflow nicht gefunden.");
    this.name = "WorkflowNotFoundError";
  }
}

export async function listWorkflowSummaries(): Promise<WorkflowHistorySummary[]> {
  const data = await request<{ workflows: WorkflowHistorySummary[] }>("GET", "/api/workflows");
  return data.workflows;
}

export async function getWorkflowRecord<T>(id: string): Promise<StoredWorkflowRecord<T> | null> {
  try {
    const data = await request<{ record: StoredWorkflowRecord<T> }>("GET", `/api/workflows/${encodeURIComponent(id)}`);
    return data.record;
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) return null;
    throw error;
  }
}

export async function putWorkflowRecord<T>(
  record: StoredWorkflowRecord<T>,
  summary: WorkflowSummaryPayload,
): Promise<void> {
  // Nur die Zusammenfassungsfelder senden; der Server validiert strikt.
  await request("PUT", `/api/workflows/${encodeURIComponent(record.id)}`, {
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    state: record.state,
    summary: {
      title: summary.title,
      currentStep: summary.currentStep,
      hasResearch: summary.hasResearch,
      hasScript: summary.hasScript,
      hasThumbnail: summary.hasThumbnail,
    },
  });
}

export async function deleteWorkflowRecord(id: string): Promise<void> {
  await request("DELETE", `/api/workflows/${encodeURIComponent(id)}`);
}

export async function pruneWorkflowRecords(): Promise<string[]> {
  const data = await request<{ removed: string[] }>("POST", "/api/workflows/prune");
  return data.removed;
}

// ---------- Einmalige Übernahme alter Browser-Workflows ----------

const LEGACY_DATABASE_NAME = "youtube-pro-workflows";
const LEGACY_STORE_NAME = "workflows";

function openLegacyDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let existed = true;
    const openRequest = indexedDB.open(LEGACY_DATABASE_NAME);
    openRequest.onupgradeneeded = () => {
      // Die Datenbank gab es noch nicht; nichts zu übernehmen.
      existed = false;
    };
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      if (!existed || !database.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        database.close();
        indexedDB.deleteDatabase(LEGACY_DATABASE_NAME);
        resolve(null);
        return;
      }
      resolve(database);
    };
    openRequest.onerror = () => resolve(null);
    openRequest.onblocked = () => resolve(null);
  });
}

export async function readLegacyIndexedDbRecords<T>(): Promise<StoredWorkflowRecord<T>[]> {
  const database = await openLegacyDatabase();
  if (!database) return [];
  try {
    return await new Promise<StoredWorkflowRecord<T>[]>((resolve) => {
      const transaction = database.transaction(LEGACY_STORE_NAME, "readonly");
      const getAll = transaction.objectStore(LEGACY_STORE_NAME).getAll();
      getAll.onsuccess = () => resolve((getAll.result as StoredWorkflowRecord<T>[]) || []);
      getAll.onerror = () => resolve([]);
    });
  } finally {
    database.close();
  }
}

export function clearLegacyIndexedDb(): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const deleteRequest = indexedDB.deleteDatabase(LEGACY_DATABASE_NAME);
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = () => resolve();
    deleteRequest.onblocked = () => resolve();
  });
}
