import { z } from "zod";

// Gemeinsamer Vertrag für Login, Benutzerverwaltung und Aktivitätsprotokoll.
// Wird von Server (Validierung) und Client (Typen) verwendet.

export const USER_ROLES = ["admin", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Der Benutzername muss mindestens 3 Zeichen haben.")
  .max(40, "Der Benutzername darf höchstens 40 Zeichen haben.")
  .regex(/^[a-zA-Z0-9._-]+$/, "Nur Buchstaben, Zahlen, Punkt, Unterstrich und Bindestrich sind erlaubt.");

export const passwordSchema = z
  .string()
  .min(8, "Das Passwort muss mindestens 8 Zeichen haben.")
  .max(200, "Das Passwort darf höchstens 200 Zeichen haben.");

export const displayNameSchema = z.string().trim().min(1).max(80);

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1, "Benutzername ist erforderlich.").max(40),
  password: z.string().min(1, "Passwort ist erforderlich.").max(200),
}).strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, "Aktuelles Passwort ist erforderlich.").max(200),
  newPassword: passwordSchema,
}).strict();
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface AuthMeResponse {
  user: SessionUser;
}

// ---------- Admin: Benutzer ----------

export interface AdminUser extends SessionUser {
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  activityCount: number;
}

export const adminCreateUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  role: z.enum(USER_ROLES).default("user"),
}).strict();
export type AdminCreateUserRequest = z.infer<typeof adminCreateUserSchema>;

export const adminUpdateUserSchema = z.object({
  displayName: displayNameSchema.optional(),
  role: z.enum(USER_ROLES).optional(),
  active: z.boolean().optional(),
  password: passwordSchema.optional(),
}).strict();
export type AdminUpdateUserRequest = z.infer<typeof adminUpdateUserSchema>;

// ---------- Aktivitätsprotokoll ----------

export const ACTIVITY_ACTIONS = [
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "auth.password_changed",
  "research.search",
  "research.insights",
  "ideas.generate",
  "script.generate",
  "script.regenerate_titles",
  "script.regenerate_section",
  "script.regenerate_paragraph",
  "script.extract_narration",
  "thumbnail.suggestions",
  "thumbnail.generate",
  "settings.view",
  "settings.save",
  "admin.user_create",
  "admin.user_update",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  "auth.login": "Anmeldung",
  "auth.login_failed": "Anmeldung fehlgeschlagen",
  "auth.logout": "Abmeldung",
  "auth.password_changed": "Passwort geändert",
  "research.search": "YouTube-Suche",
  "research.insights": "KI-Insights",
  "ideas.generate": "Ideen generiert",
  "script.generate": "Skript generiert",
  "script.regenerate_titles": "Titel neu generiert",
  "script.regenerate_section": "Abschnitt neu generiert",
  "script.regenerate_paragraph": "Absatz neu generiert",
  "script.extract_narration": "Sprechtext extrahiert",
  "thumbnail.suggestions": "Thumbnail-Textvorschläge",
  "thumbnail.generate": "Thumbnail generiert",
  "settings.view": "Einstellungen geöffnet",
  "settings.save": "Einstellungen gespeichert",
  "admin.user_create": "Benutzer angelegt",
  "admin.user_update": "Benutzer geändert",
};

// Inhaltsarten, die der Server zu einer Aktivität speichert.
export const CONTENT_KINDS = [
  "research_snapshot",
  "research_insights",
  "ideas",
  "script",
  "script_titles",
  "script_section",
  "script_paragraph",
  "narration",
  "thumbnail_suggestions",
  "thumbnail",
] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  research_snapshot: "Recherche-Snapshot",
  research_insights: "KI-Insights",
  ideas: "Ideen",
  script: "Skript",
  script_titles: "Titelvorschläge",
  script_section: "Abschnitt",
  script_paragraph: "Absatz",
  narration: "Sprechtext",
  thumbnail_suggestions: "Thumbnail-Textvorschläge",
  thumbnail: "Thumbnail",
};

export interface ActivityEntry {
  id: number;
  userId: number | null;
  username: string | null;
  displayName: string | null;
  action: ActivityAction;
  summary: string;
  status: number;
  durationMs: number;
  ip: string | null;
  createdAt: string;
  details: Record<string, unknown> | null;
  contentId: number | null;
  contentKind: ContentKind | null;
}

export interface ActivityListResponse {
  entries: ActivityEntry[];
  nextBefore: number | null;
}

export const activityListQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  action: z.enum(ACTIVITY_ACTIONS).optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export interface ContentRecord {
  id: number;
  activityId: number | null;
  userId: number | null;
  username: string | null;
  kind: ContentKind;
  title: string;
  createdAt: string;
  // JSON-Payload. Bei "thumbnail" enthält `image` eine data:image-URL.
  payload: unknown;
}

export interface AdminStats {
  users: number;
  activeUsers: number;
  activitiesTotal: number;
  activitiesLast24h: number;
  contents: number;
  perUser: Array<{
    userId: number;
    username: string;
    displayName: string;
    role: UserRole;
    activities: number;
    lastActivityAt: string | null;
  }>;
}

// ---------- Workflows (serverseitig pro Benutzer gespeichert) ----------

export type WorkflowStepName = "research" | "script" | "thumbnail";

// Ein gespeicherter Workflow. `state` ist der komplette Client-Zustand
// (Recherche, Idee, Skript, Thumbnail) und wird als JSONB abgelegt.
export interface WorkflowRecordPayload<T = unknown> {
  id: string;
  createdAt: number;
  updatedAt: number;
  state: T;
}

export interface WorkflowSummaryPayload {
  title: string;
  currentStep: WorkflowStepName;
  hasResearch: boolean;
  hasScript: boolean;
  hasThumbnail: boolean;
}

export const workflowIdSchema = z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._-]+$/);

export const workflowSummaryPayloadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  currentStep: z.enum(["research", "script", "thumbnail"]),
  hasResearch: z.boolean(),
  hasScript: z.boolean(),
  hasThumbnail: z.boolean(),
}).strict();

export const workflowUpsertSchema = z.object({
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  state: z.unknown(),
  summary: workflowSummaryPayloadSchema,
}).strict();
export type WorkflowUpsertRequest = z.infer<typeof workflowUpsertSchema>;

// Admin-Sicht auf Workflows aller Benutzer, inklusive vom Benutzer gelöschter.
export interface AdminWorkflowSummary extends WorkflowSummaryPayload {
  id: string;
  userId: number;
  username: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: string | null;
  researchQuery: string | null;
  videoCount: number;
}

export interface AdminWorkflowListResponse {
  workflows: AdminWorkflowSummary[];
}

export interface AdminWorkflowDetailResponse {
  workflow: AdminWorkflowSummary;
  state: unknown;
}
