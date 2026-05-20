import { withBase } from "./app-base";
import { createActor } from "@/backend";
import { createActorWithConfig } from "@caffeineai/core-infrastructure";

/**
 * Typed API client for the Bawjiase Staff Portal backend.
 * Since the backend schema evolves via bindgen, we work with mock/local
 * implementations here to match the contract signatures.
 * All functions are designed to be swapped to real actor calls.
 */

import {
  BRANCHES,
  DEPARTMENTS,
} from "../types";
import type { MappedRow } from "./agm-import-utils";
import { buildRegistrationNotes } from "./agm-registration-utils";
import {
  AGM_BRANCH_OPTIONS,
  AGM_SHAREHOLDERS,
  AGM_SUMMARY,
  type AgmBoardHighlight,
  type AgmBranchTurnout,
  type AgmImportBatchRecord,
  type AgmOperatorActivityRecord,
  type AgmRecentRegistration,
  type AgmRegistrationType,
  type AgmSettingsRecord,
  type AgmShareholderRecord,
} from "./agm-module";
import type {
  Announcement,
  AnnouncementWithPoll,
  ApiResult,
  AuditLog,
  Branch,
  DashboardOverview,
  Department,
  IncidentReport,
  Notification,
  PortalForm,
  ProfileAmendment,
  StaffStats,
  TrainingDocument,
  TrainingVideo,
  User,
  UserPermissions,
} from "../types";

const OFFICIAL_EMAIL_DOMAIN = "@bawjiasearearuralbank.com";
const IT_ACCESS_CODE = (import.meta.env.VITE_IT_ACCESS_CODE || "").trim();
const HR_ACCESS_CODE = (import.meta.env.VITE_HR_ACCESS_CODE || "").trim();
const MAIL_API_URL = (
  import.meta.env.VITE_MAIL_API_URL || `${window.location.origin}/mail-api/api`
).replace(/\/$/, "");
const MAIL_API_ROOT = MAIL_API_URL.replace(/\/api$/, "");
const ANNOUNCEMENT_DISMISS_KEY = "bcb_announcement_dismissals";
const USERS_STORE_KEY = "bcb_mock_users";
const AUTH_STORAGE_KEY = "bcb_auth_user";
const ANNOUNCEMENTS_STORE_KEY = "bcb_announcements_cache";
const FORMS_STORE_KEY = "bcb_forms_cache";
const TRAINING_VIDEOS_STORE_KEY = "bcb_training_videos_cache";
const TRAINING_DOCUMENTS_STORE_KEY = "bcb_training_documents_cache";
const NOTIFICATIONS_STORE_KEY = "bcb_notifications_cache";
const AUDIT_LOGS_STORE_KEY = "bcb_audit_logs_cache";
const AGM_SHAREHOLDERS_STORE_KEY = "bcb_agm_shareholders_cache";
const AGM_IMPORT_BATCHES_STORE_KEY = "bcb_agm_import_batches_cache";
const AGM_SETTINGS_STORE_KEY = "bcb_agm_settings_cache";
const AGM_OPERATOR_ACTIVITY_STORE_KEY = "bcb_agm_operator_activity_cache";
const AGM_AUTH_STORAGE_KEY = "bcb_agm_auth_session";
const USERS_UPDATED_EVENT = "bcb:users-updated";
export const ANNOUNCEMENTS_UPDATED_EVENT = "bcb:announcements-updated";
export const FORMS_UPDATED_EVENT = "bcb:forms-updated";
export const AGM_UPDATED_EVENT = "bcb:agm-updated";
const OPTIONAL_API_TIMEOUT_MS = 8000;
const SESSION_EXPIRED_EVENT = "bcb:session-expired";
const ENABLE_SEEDED_FALLBACK =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_SEEDED_FALLBACK === "true";
const RECENT_USER_OVERRIDE_MS = 30 * 1000;
const REQUEST_ACTIVITY_EVENT = "bcb:request-activity";
const ACTIVITY_LOG_UPDATED_EVENT = "bcb:activity-log-updated";
const ACTIVITY_LOG_KEY = "bcb_activity_log";
const ACTIVITY_LOG_LIMIT = 40;

export function buildClient<TActor>(actor: TActor): TActor {
  return actor;
}

export interface ActivityLogEntry {
  id: string;
  title: string;
  detail: string;
  timestamp: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok<T>(value: T): ApiResult<T> {
  return { ok: value };
}

function err<T>(message: string): ApiResult<T> {
  return { err: message };
}

function dispatchRequestActivity(
  detail:
    | {
        kind: "start" | "finish";
        pendingCount?: number;
      }
    | {
        kind: "slow";
        path: string;
      },
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(REQUEST_ACTIVITY_EVENT, {
      detail,
    }),
  );
}

let pendingRequestCount = 0;

async function withRequestActivity<T>(
  path: string,
  task: () => Promise<T>,
): Promise<T> {
  pendingRequestCount += 1;
  dispatchRequestActivity({ kind: "start", pendingCount: pendingRequestCount });
  let slowTimer: number | null = window.setTimeout(() => {
    dispatchRequestActivity({ kind: "slow", path });
  }, 2000);
  try {
    return await task();
  } finally {
    if (slowTimer !== null) {
      window.clearTimeout(slowTimer);
      slowTimer = null;
    }
    pendingRequestCount = Math.max(0, pendingRequestCount - 1);
    dispatchRequestActivity({
      kind: "finish",
      pendingCount: pendingRequestCount,
    });
  }
}

function loadActivityLog(): ActivityLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACTIVITY_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ActivityLogEntry[];
  } catch {
    return [];
  }
}

function persistActivityLog(entries: ActivityLogEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent(ACTIVITY_LOG_UPDATED_EVENT));
  } catch {
    // ignore storage failures
  }
}

function serializeContentCache<T>(items: T[]): string {
  return JSON.stringify(items, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

function loadContentCache<T>(
  key: string,
  fallback: T[],
  revive: (raw: Record<string, unknown>) => T,
): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return ENABLE_SEEDED_FALLBACK ? fallback : [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ENABLE_SEEDED_FALLBACK ? fallback : [];
    return parsed.map((item) => revive(item as Record<string, unknown>));
  } catch {
    return ENABLE_SEEDED_FALLBACK ? fallback : [];
  }
}

function persistContentCache<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, serializeContentCache(items));
  } catch {
    // ignore storage failures
  }
}

function dispatchAgmUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AGM_UPDATED_EVENT));
}

export function apiGetActivityLog(): ActivityLogEntry[] {
  return loadActivityLog();
}

export function apiRecordActivity(title: string, detail: string) {
  const nextEntry: ActivityLogEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    detail,
    timestamp: Date.now(),
  };
  const entries = [nextEntry, ...loadActivityLog()].slice(0, ACTIVITY_LOG_LIMIT);
  persistActivityLog(entries);
}

export function apiClearActivityLog() {
  persistActivityLog([]);
}

function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sessionToken?: string };
    return typeof parsed.sessionToken === "string" && parsed.sessionToken
      ? parsed.sessionToken
      : null;
  } catch {
    return null;
  }
}

function withSessionToken(url: string): string {
  const token = getStoredSessionToken();
  if (!token) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}sessionToken=${encodeURIComponent(token)}`;
}

function withCacheBuster(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_ts=${Date.now()}`;
}

function isNetworkFetchError(error: unknown): boolean {
  return error instanceof TypeError;
}

function getMailApiCandidates(path: string): string[] {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const candidates = new Set<string>();
  const configured = `${MAIL_API_URL}${normalizedPath}`;
  candidates.add(configured);

  if (typeof window !== "undefined") {
    candidates.add(`${window.location.origin}/mail-api/api${normalizedPath}`);
    candidates.add(`${window.location.origin}/api${normalizedPath}`);
  }

  if (MAIL_API_ROOT) {
    candidates.add(`${MAIL_API_ROOT}/api${normalizedPath}`);
  }

  return Array.from(candidates);
}

async function requestMailApiResponse(
  path: string,
  buildRequest: (url: string, token: string | null) => Promise<Response>,
): Promise<Response> {
  const token = getStoredSessionToken();
  const candidates = getMailApiCandidates(path);
  let lastError: unknown = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      return await buildRequest(candidate, token);
    } catch (error) {
      lastError = error;
      if (!isNetworkFetchError(error) || index === candidates.length - 1) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Authentication service unavailable. Please try again.");
}

function handleSessionExpired() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

async function postMailApi(path: string, payload: Record<string, unknown>) {
  const response = await withRequestActivity(path, async () => {
    return requestMailApiResponse(path, async (url, token) =>
      fetch(withSessionToken(url), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      }),
    );
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    if (response.status === 401) {
      handleSessionExpired();
      throw new Error("Session expired. Please log in again.");
    }
    throw new Error(data.error || "Email could not be sent");
  }
}

async function postMailApiJson(
  path: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await withRequestActivity(path, async () => {
    return requestMailApiResponse(path, async (url, token) =>
      fetch(withSessionToken(url), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      }),
    );
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
  };
  if (!response.ok) {
    if (response.status === 401) {
      handleSessionExpired();
      throw new Error("Session expired. Please log in again.");
    }
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function getMailApiJson(path: string): Promise<Record<string, unknown>> {
  const response = await withRequestActivity(path, async () => {
    return requestMailApiResponse(path, async (url, token) =>
      fetch(withCacheBuster(withSessionToken(url)), {
        method: "GET",
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    );
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
  };
  if (!response.ok) {
    if (response.status === 401) {
      handleSessionExpired();
      throw new Error("Session expired. Please log in again.");
    }
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function uploadMailApiFile(
  path: string,
  file: File,
): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await withRequestActivity(path, async () => {
    return requestMailApiResponse(path, async (url, token) =>
      fetch(withSessionToken(url), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      }),
    );
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
  };
  if (!response.ok) {
    if (response.status === 401) {
      handleSessionExpired();
      throw new Error("Session expired. Please log in again.");
    }
    throw new Error(data.error || "Upload failed");
  }
  return data;
}

type WireUser = Omit<User, "lastSeen" | "registrationTime"> & {
  lastSeen: string | number;
  registrationTime: string | number;
};

function deserializePermissions(raw: unknown): UserPermissions | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Record<string, unknown>;
  return {
    announcements: !!source.announcements,
    forms: !!source.forms,
    trainingVideos: !!source.trainingVideos,
    trainingDocuments: !!source.trainingDocuments,
    support: !!source.support,
    userManagement: !!source.userManagement,
  };
}

function deserializeScopeList(raw: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  const normalized = raw
    .map((item) => String(item ?? "").trim().toUpperCase())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : [...fallback];
}

function deserializeAgmRegistrationType(raw: unknown): AgmRegistrationType {
  if (raw === "In Person" || raw === "Proxy" || raw === "Not Registered") {
    return raw;
  }
  return "Not Registered";
}

function deserializeAgmShareholder(
  raw: Record<string, unknown>,
): AgmShareholderRecord {
  return {
    id: String(raw.id ?? `agm-${Date.now()}`),
    fullName: String(raw.fullName ?? ""),
    shareholderNumber: String(raw.shareholderNumber ?? "").trim().toUpperCase(),
    branch: String(raw.branch ?? ""),
    shareholding: Number(raw.shareholding ?? 0),
    phone: String(raw.phone ?? ""),
    ghanaCardId: String(raw.ghanaCardId ?? "").trim().toUpperCase(),
    registrationType: deserializeAgmRegistrationType(raw.registrationType),
    verificationCode: String(raw.verificationCode ?? ""),
    registeredBy: String(raw.registeredBy ?? ""),
    registeredAt:
      raw.registeredAt == null || raw.registeredAt === ""
        ? null
        : String(raw.registeredAt),
    checkedInAt:
      raw.checkedInAt == null || raw.checkedInAt === ""
        ? null
        : String(raw.checkedInAt),
    proxyName:
      raw.proxyName == null || raw.proxyName === ""
        ? undefined
        : String(raw.proxyName),
    proxyPhone:
      raw.proxyPhone == null || raw.proxyPhone === ""
        ? undefined
        : String(raw.proxyPhone),
  };
}

function deserializeAgmImportBatch(
  raw: Record<string, unknown>,
): AgmImportBatchRecord {
  return {
    id: String(raw.id ?? `agm-batch-${Date.now()}`),
    filename: String(raw.filename ?? ""),
    branch: String(raw.branch ?? ""),
    importedAt: String(raw.importedAt ?? new Date().toISOString()),
    importedRows: Number(raw.importedRows ?? 0),
    duplicateRows: Number(raw.duplicateRows ?? 0),
    errorRows: Number(raw.errorRows ?? 0),
    status:
      raw.status === "Completed With Issues"
        ? "Completed With Issues"
        : "Completed",
    operatorName: String(raw.operatorName ?? "AGM Operator"),
  };
}

function deserializeAgmSettings(raw: Record<string, unknown>): AgmSettingsRecord {
  return {
    agmName: String(raw.agmName ?? AGM_SUMMARY.agmName),
    venue: String(raw.venue ?? AGM_SUMMARY.venue),
    agmDate: String(raw.agmDate ?? AGM_SUMMARY.agmDate),
    quorumRequiredPct: Number(raw.quorumRequiredPct ?? AGM_SUMMARY.quorumRequiredPct),
  };
}

function deserializeAgmOperatorActivity(
  raw: Record<string, unknown>,
): AgmOperatorActivityRecord {
  return {
    id: String(raw.id ?? `agm-activity-${Date.now()}`),
    operatorName: String(raw.operatorName ?? "AGM Operator"),
    action: String(raw.action ?? "Updated AGM"),
    target: String(raw.target ?? "AGM Workspace"),
    branch: String(raw.branch ?? "Head Office"),
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
  };
}

let agmActorPromise: Promise<ReturnType<typeof createActor> | null> | null = null;

async function getAgmActor(): Promise<ReturnType<typeof createActor> | null> {
  if (!agmActorPromise) {
    agmActorPromise = createActorWithConfig(createActor).catch(() => null);
  }
  return agmActorPromise;
}

function getStoredAgmSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AGM_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return typeof parsed.token === "string" && parsed.token.trim().length > 0
      ? parsed.token
      : null;
  } catch {
    return null;
  }
}

function getStoredAgmYear(): string {
  if (typeof window === "undefined") return AGM_ACTIVE_YEAR;
  try {
    return window.localStorage.getItem("bcb_agm_active_year") ?? AGM_ACTIVE_YEAR;
  } catch {
    return AGM_ACTIVE_YEAR;
  }
}

function unwrapAgmResult<T>(result: unknown): T {
  if (!result || typeof result !== "object") {
    throw new Error("AGM backend request failed");
  }
  const record = result as Record<string, unknown>;
  if ("err" in record && typeof record.err === "string") {
    throw new Error(record.err);
  }
  if ("ok" in record) {
    return record.ok as T;
  }
  throw new Error("AGM backend request failed");
}

function agmVariantKey(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  return Object.keys(value as Record<string, unknown>)[0] ?? "";
}

function agmOptionalText(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function agmTimestampToIso(value: unknown): string | null {
  if (typeof value === "bigint") {
    return new Date(Number(value / 1_000_000n)).toISOString();
  }
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  return null;
}

const AGM_BRANCH_LABELS: Record<string, string> = {
  HEADOFFICE: "Head Office",
  HEAD_OFFICE: "Head Office",
  BAWJIASE: "Bawjiase",
  ADEISO: "Adeiso",
  OFAAKOR: "Ofaakor",
  KASOAMAIN: "Kasoa Main",
  KASOA_MAIN: "Kasoa Main",
  KASOANEWMARKET: "Kasoa New Market",
  KASOA_NEW_MARKET: "Kasoa New Market",
};

function normalizeAgmBranchLabel(value: string): string {
  const normalized = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return AGM_BRANCH_LABELS[normalized] ?? value;
}

function buildAgmBranchTag(branch: string): string {
  return `branch:${normalizeAgmBranchLabel(branch)}`;
}

function extractAgmBranch(tags: string[]): string {
  for (const tag of tags) {
    const normalized = tag.trim();
    if (!normalized) continue;
    if (normalized.toLowerCase().startsWith("branch:")) {
      return normalizeAgmBranchLabel(normalized.slice(7).trim());
    }
    const direct = normalizeAgmBranchLabel(normalized);
    if (AGM_BRANCH_OPTIONS.includes(direct as (typeof AGM_BRANCH_OPTIONS)[number])) {
      return direct;
    }
  }
  return "Head Office";
}

function deserializeUser(user: WireUser): User {
  const raw = user as Record<string, unknown>;
  return {
    ...user,
    imageFile: typeof user.imageFile === "string" ? user.imageFile : null,
    managedBranches: deserializeScopeList(raw.managedBranches),
    managedDepartmentsByBranch:
      raw.managedDepartmentsByBranch &&
      typeof raw.managedDepartmentsByBranch === "object"
        ? Object.fromEntries(
            Object.entries(
              raw.managedDepartmentsByBranch as Record<string, unknown>,
            ).map(([branch, departments]) => [
              branch.toUpperCase(),
              deserializeScopeList(departments),
            ]),
          )
        : {},
    permissions: deserializePermissions(raw.permissions),
    isOnlineNow: !!raw.isOnlineNow,
    lastSeen: BigInt(user.lastSeen ?? 0),
    registrationTime: BigInt(user.registrationTime ?? 0),
  };
}

function deserializeNotification(raw: Record<string, unknown>): Notification {
  const kindValue = String(raw.kind ?? "system");
  const kind: Notification["kind"] =
    kindValue === "announcement" ||
    kindValue === "poll" ||
    kindValue === "training" ||
    kindValue === "support"
      ? kindValue
      : "system";
  return {
    id: Number(raw.id ?? 0),
    userId: String(raw.userId ?? ""),
    kind,
    title: String(raw.title ?? ""),
    message: String(raw.message ?? ""),
    linkTo: typeof raw.linkTo === "string" ? raw.linkTo : null,
    isRead: !!raw.isRead,
    createdAt: contentBigInt(raw.createdAt),
  };
}

// ── Auth / Registration ───────────────────────────────────────────────────────

export interface RegisterRequest {
  fullname: string;
  phone: string;
  email: string;
  passwordHash: string;
  role: string;
  position: string;
  department: string;
  branch: string;
  accessCode?: string;
}

export interface UpdateProfileRequest {
  fullname?: string;
  phone?: string;
  position?: string;
  department?: string;
  branch?: string;
  imageFile?: string | null;
  accessCode?: string;
}

export interface UpdateStaffRequest extends UpdateProfileRequest {
  role?: string;
  isActive?: boolean;
  accessCode?: string;
  managedBranches?: string[];
  managedDepartmentsByBranch?: Record<string, string[]>;
  permissions?: UserPermissions;
}

// Simulate backend calls — replace actor body when bindgen exposes methods

const INITIAL_MOCK_USERS: User[] = [
  {
    id: "db-user-6",
    fullname: "Desmond Tettey Quarshie",
    phone: "0243670230",
    email: "dquarshie@bawjiasearearuralbank.com",
    role: "GeneralStaff",
    position: "Staff",
    department: "BANKING OPERATIONS",
    branch: "HEAD OFFICE",
    imageFile: null,
    isActive: true,
    isVerified: true,
    lastSeen: BigInt(1772637593885),
    registrationTime: BigInt(0),
    isArchived: false,
  },
  {
    id: "db-user-9",
    fullname: "Jane Afua Bruku",
    phone: "0248154869",
    email: "jbruku@bawjiasearearuralbank.com",
    role: "GeneralStaff",
    position: "Staff",
    department: "COMPLIANCE",
    branch: "HEAD OFFICE",
    imageFile: null,
    isActive: true,
    isVerified: true,
    lastSeen: BigInt(1770741882598),
    registrationTime: BigInt(0),
    isArchived: false,
  },
  {
    id: "db-user-5",
    fullname: "Kwabena Asare",
    phone: "0599779664",
    email: "kasare@bawjiasearearuralbank.com",
    role: "GeneralStaff",
    position: "Staff",
    department: "COMPLIANCE",
    branch: "HEAD OFFICE",
    imageFile: null,
    isActive: true,
    isVerified: true,
    lastSeen: BigInt(1770990814598),
    registrationTime: BigInt(0),
    isArchived: false,
  },
  {
    id: "db-user-8",
    fullname: "Kwesi Adu Snr Yeenu-Prah",
    phone: "0555443053",
    email: "kyeenu-prah@bawjiasearearuralbank.com",
    role: "HRAdmin",
    position: "Staff",
    department: "HR",
    branch: "HEAD OFFICE",
    imageFile: withBase("profile_pics/f658de3c2aa8ca6d.jpeg"),
    isActive: true,
    isVerified: true,
    lastSeen: BigInt(1770296150530),
    registrationTime: BigInt(0),
    isArchived: false,
  },
  {
    id: "db-user-4",
    fullname: "Ato Asiedu Mensah",
    phone: "0247554428",
    email: "amensah@bawjiasearearuralbank.com",
    role: "SuperAdmin",
    position: "Staff",
    department: "IT",
    branch: "HEAD OFFICE",
    imageFile: null,
    isActive: true,
    isVerified: true,
    lastSeen: BigInt(1770975614364),
    registrationTime: BigInt(0),
    isArchived: false,
  },
  {
    id: "db-user-2",
    fullname: "James Lincoln Awuah",
    phone: "0536799490",
    email: "lawuah@bawjiasearearuralbank.com",
    role: "SuperAdmin",
    position: "Staff",
    department: "IT",
    branch: "HEAD OFFICE",
    imageFile: withBase("profile_pics/88efb134d068db11.jpg"),
    isActive: true,
    isVerified: true,
    lastSeen: BigInt(1775309044811),
    registrationTime: BigInt(0),
    isArchived: false,
  },
  {
    id: "db-user-3",
    fullname: "Nathaniel Oglie Narh",
    phone: "0246377830",
    email: "nnarh@bawjiasearearuralbank.com",
    role: "SuperAdmin",
    position: "Staff",
    department: "IT",
    branch: "HEAD OFFICE",
    imageFile: null,
    isActive: true,
    isVerified: true,
    lastSeen: BigInt(1769519876185),
    registrationTime: BigInt(0),
    isArchived: false,
  },
  {
    id: "db-user-7",
    fullname: "GABRIEL OWUSU",
    phone: "0246315586",
    email: "gowusu@bawjiasearearuralbank.com",
    role: "GeneralStaff",
    position: "Staff",
    department: "RECOVERY",
    branch: "HEAD OFFICE",
    imageFile: null,
    isActive: true,
    isVerified: true,
    lastSeen: BigInt(1769689048721),
    registrationTime: BigInt(0),
    isArchived: false,
  },
];

function serializeUsers(users: User[]) {
  return JSON.stringify(
    users.map((user) => ({
      ...user,
      lastSeen: user.lastSeen.toString(),
      registrationTime: user.registrationTime.toString(),
    })),
  );
}

function deserializeUsers(raw: string): User[] {
  return (JSON.parse(raw) as WireUser[]).map(deserializeUser);
}

function loadUsersStore(): User[] {
  if (typeof window === "undefined") {
    return INITIAL_MOCK_USERS.map((user) => ({ ...user }));
  }
  try {
    const raw = window.localStorage.getItem(USERS_STORE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        USERS_STORE_KEY,
        serializeUsers(INITIAL_MOCK_USERS),
      );
      return INITIAL_MOCK_USERS.map((user) => ({ ...user }));
    }
    return deserializeUsers(raw);
  } catch {
    return INITIAL_MOCK_USERS.map((user) => ({ ...user }));
  }
}

async function postOptionalApi(
  path: string,
  payload: Record<string, unknown>,
  sessionTokenOverride?: string | null,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), OPTIONAL_API_TIMEOUT_MS);
  const token = sessionTokenOverride ?? getStoredSessionToken();
  try {
    const url = token
      ? `${MAIL_API_URL}${path}?sessionToken=${encodeURIComponent(token)}`
      : `${MAIL_API_URL}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function getOptionalApi(
  path: string,
  sessionTokenOverride?: string | null,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), OPTIONAL_API_TIMEOUT_MS);
  const token = sessionTokenOverride ?? getStoredSessionToken();
  try {
    const url = token
      ? `${MAIL_API_URL}${path}?sessionToken=${encodeURIComponent(token)}`
      : `${MAIL_API_URL}${path}`;
    const response = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function postKeepaliveApi(
  path: string,
  payload: Record<string, unknown>,
  sessionTokenOverride?: string | null,
): Promise<void> {
  const token = sessionTokenOverride ?? getStoredSessionToken();
  const url = token
    ? `${MAIL_API_URL}${path}?sessionToken=${encodeURIComponent(token)}`
    : `${MAIL_API_URL}${path}`;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const body = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      const sent = navigator.sendBeacon(url, body);
      if (sent) return;
    }
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Ignore keepalive failures so logout can still continue locally.
  }
}

function currentPresenceTimestampMs(): bigint {
  return BigInt(Date.now());
}

function applyPresenceMap(users: User[], presence: Record<string, bigint>) {
  for (const user of users) {
    const sharedLastSeen = presence[user.id];
    user.isOnlineNow = !!sharedLastSeen;
    if (sharedLastSeen) {
      user.lastSeen = sharedLastSeen;
    }
  }
}

async function fetchSharedPresenceMap(
  sessionTokenOverride?: string | null,
): Promise<Record<string, bigint>> {
  const payload = await getOptionalApi("/presence", sessionTokenOverride);
  const rawPresence = payload?.presence;
  if (!rawPresence || typeof rawPresence !== "object") {
    return {};
  }
  return Object.entries(rawPresence as Record<string, unknown>).reduce<Record<string, bigint>>(
    (acc, [userId, seconds]) => {
      const numeric =
        typeof seconds === "number"
          ? seconds
          : typeof seconds === "string"
            ? Number(seconds)
            : NaN;
      if (Number.isFinite(numeric) && numeric > 0) {
        acc[userId] = BigInt(Math.trunc(numeric * 1000));
      }
      return acc;
    },
    {},
  );
}

async function pingSharedPresence(userId: string, sessionTokenOverride?: string | null) {
  const payload = await postOptionalApi("/presence/ping", { userId }, sessionTokenOverride);
  const lastSeen = payload?.lastSeen;
  if (typeof lastSeen === "number" && Number.isFinite(lastSeen)) {
    return BigInt(Math.trunc(lastSeen * 1000));
  }
  if (typeof lastSeen === "string" && Number.isFinite(Number(lastSeen))) {
    return BigInt(Math.trunc(Number(lastSeen) * 1000));
  }
  return null;
}

async function logoutSharedPresence(userId: string, sessionTokenOverride?: string | null) {
  await postKeepaliveApi("/presence/logout", { userId }, sessionTokenOverride);
}

export async function apiSetPresenceOffline(
  userId: string,
  sessionTokenOverride?: string | null,
): Promise<void> {
  await logoutSharedPresence(userId, sessionTokenOverride);
  const user = _mockUsers.find((item) => item.id === userId);
  if (user) {
    user.isOnlineNow = false;
    persistUsersStore();
  }
}

let _mockUsers: User[] = loadUsersStore();
const _recentUserOverrides = new Map<
  string,
  { user: User; expiresAt: number; signature: string }
>();

function persistUsersStore(notify = true) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USERS_STORE_KEY, serializeUsers(_mockUsers));
  if (notify) {
    window.dispatchEvent(new CustomEvent(USERS_UPDATED_EVENT));
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function userSyncSignature(user: User): string {
  return JSON.stringify({
    id: user.id,
    fullname: user.fullname,
    phone: user.phone,
    email: user.email,
    branch: user.branch,
    department: user.department,
    role: user.role,
    position: user.position,
    isActive: user.isActive,
    isArchived: user.isArchived,
    imageFile: user.imageFile ?? null,
    managedBranches: user.managedBranches ?? [],
    managedDepartmentsByBranch: user.managedDepartmentsByBranch ?? {},
    permissions: user.permissions,
  });
}

function rememberRecentUserOverride(user: User) {
  _recentUserOverrides.set(user.id, {
    user,
    expiresAt: Date.now() + RECENT_USER_OVERRIDE_MS,
    signature: userSyncSignature(user),
  });
}

function resolveRecentUserOverride(user: User): User {
  const override = _recentUserOverrides.get(user.id);
  if (!override) return user;
  if (override.expiresAt <= Date.now()) {
    _recentUserOverrides.delete(user.id);
    return user;
  }
  if (override.signature === userSyncSignature(user)) {
    _recentUserOverrides.delete(user.id);
    return user;
  }
  return {
    ...user,
    ...override.user,
    sessionToken: override.user.sessionToken ?? user.sessionToken,
    isOnlineNow: override.user.isOnlineNow ?? user.isOnlineNow,
    lastSeen:
      override.user.lastSeen > user.lastSeen ? override.user.lastSeen : user.lastSeen,
  };
}

function applyRecentUserOverrides(users: User[]): User[] {
  return users.map((user) => resolveRecentUserOverride(user));
}

async function refreshUsersCache(): Promise<User[]> {
  try {
    const payload = await getMailApiJson("/users");
    const rawUsers = Array.isArray(payload.users) ? (payload.users as WireUser[]) : [];
    const knownTokens = new Map(
      _mockUsers
        .filter((user) => user.sessionToken)
        .map((user) => [user.id, user.sessionToken as string]),
    );
    const currentToken = getStoredSessionToken();
    _mockUsers = rawUsers.map((rawUser) => {
      const user = deserializeUser(rawUser);
      user.sessionToken = knownTokens.get(user.id) ?? user.sessionToken;
      return user;
    });
    _mockUsers = applyRecentUserOverrides(_mockUsers);
    if (currentToken) {
      const currentAuthRaw = window.localStorage.getItem(AUTH_STORAGE_KEY);
      if (currentAuthRaw) {
        const currentAuth = deserializeUser(JSON.parse(currentAuthRaw) as WireUser);
        const idx = _mockUsers.findIndex((user) => user.id === currentAuth.id);
        if (idx >= 0) {
          _mockUsers[idx] = {
            ..._mockUsers[idx],
            sessionToken: currentToken,
          };
        }
      }
    }
    persistUsersStore(false);
  } catch {
    _mockUsers = loadUsersStore().map((user) => ({
      ...user,
      isOnlineNow: false,
    }));
  }
  return _mockUsers;
}

async function fetchUserById(userId: string): Promise<User | null> {
  try {
    const payload = await getMailApiJson(`/users/${encodeURIComponent(userId)}`);
    const rawUser = payload.user as WireUser | undefined;
    if (!rawUser) return null;
  const user = deserializeUser(rawUser);
  user.sessionToken =
    _mockUsers.find((item) => item.id === user.id)?.sessionToken ??
    getStoredSessionToken() ??
    undefined;
  const resolvedUser = resolveRecentUserOverride(user);
  const idx = _mockUsers.findIndex((item) => item.id === user.id);
  if (idx >= 0) {
    _mockUsers[idx] = resolvedUser;
  } else {
    _mockUsers.push(resolvedUser);
  }
  persistUsersStore(false);
  return resolvedUser;
} catch {
  return _mockUsers.find((user) => user.id === userId) ?? null;
}
}

function upsertCachedUser(user: User) {
  const idx = _mockUsers.findIndex((item) => item.id === user.id);
  if (idx >= 0) {
    _mockUsers[idx] = user;
  } else {
    _mockUsers.push(user);
  }
  persistUsersStore();
}

export function apiSyncCachedUser(user: User) {
  upsertCachedUser(user);
}

function contentId(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function contentBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" || typeof value === "string") {
    return BigInt(value);
  }
  return BigInt(0);
}

function deserializeAnnouncement(raw: Record<string, unknown>): AnnouncementWithPoll {
  const pollRaw = raw.poll as Record<string, unknown> | null | undefined;
  return {
    id: contentId(raw.id),
    title: String(raw.title ?? ""),
    content: String(raw.content ?? ""),
    category: String(raw.category ?? ""),
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    fileUrl: typeof raw.fileUrl === "string" ? raw.fileUrl : null,
    attachmentName: typeof raw.attachmentName === "string" ? raw.attachmentName : null,
    allowDownload: raw.allowDownload !== false,
    authorId: String(raw.authorId ?? ""),
    authorName: String(raw.authorName ?? ""),
    createdAt: contentBigInt(raw.createdAt),
    updatedAt: contentBigInt(raw.updatedAt),
    isDismissed: !!raw.isDismissed,
    isTrashed: !!raw.isTrashed,
    visibility: raw.visibility === "Department" ? "Department" : "General",
    department: typeof raw.department === "string" ? raw.department : null,
    branchScope: deserializeScopeList(raw.branchScope, ["ALL"]),
    departmentScope: deserializeScopeList(
      raw.departmentScope,
      typeof raw.department === "string" && raw.department
        ? [String(raw.department).toUpperCase()]
        : ["ALL"],
    ),
    poll: pollRaw
      ? {
          id: contentId(pollRaw.id),
          question: String(pollRaw.question ?? ""),
          options: Array.isArray(pollRaw.options)
            ? (pollRaw.options as Array<Record<string, unknown>>).map((option) => ({
                id: contentId(option.id),
                text: String(option.text ?? ""),
                votes: Number(option.votes ?? 0),
              }))
            : [],
          totalVotes: Number(pollRaw.totalVotes ?? 0),
          userVotedOptionId:
            pollRaw.userVotedOptionId === null || pollRaw.userVotedOptionId === undefined
              ? null
              : contentId(pollRaw.userVotedOptionId),
          endDate:
            pollRaw.endDate === null || pollRaw.endDate === undefined
              ? null
              : contentBigInt(pollRaw.endDate),
          isActive: pollRaw.isActive !== false,
        }
      : null,
  };
}

function deserializeForm(raw: Record<string, unknown>): PortalForm {
  return {
    id: contentId(raw.id),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    fileUrl: String(raw.fileUrl ?? ""),
    category: String(raw.category ?? ""),
    visibleTo: Array.isArray(raw.visibleTo)
      ? (raw.visibleTo as PortalForm["visibleTo"])
      : [],
    visibility:
      raw.visibility === "Department" ? "Department" : "General",
    department: typeof raw.department === "string" ? raw.department : null,
    branchScope: deserializeScopeList(raw.branchScope, ["ALL"]),
    departmentScope: deserializeScopeList(
      raw.departmentScope,
      typeof raw.department === "string" && raw.department
        ? [String(raw.department).toUpperCase()]
        : ["ALL"],
    ),
    createdAt: contentBigInt(raw.createdAt),
    updatedAt: contentBigInt(raw.updatedAt),
  };
}

function deserializeTrainingVideo(raw: Record<string, unknown>): TrainingVideo {
  return {
    id: contentId(raw.id),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    videoUrl: String(raw.videoUrl ?? ""),
    thumbnailUrl: typeof raw.thumbnailUrl === "string" ? raw.thumbnailUrl : null,
    duration: Number(raw.duration ?? 0),
    category: String(raw.category ?? ""),
    visibleTo: Array.isArray(raw.visibleTo)
      ? (raw.visibleTo as TrainingVideo["visibleTo"])
      : [],
    visibility: raw.visibility === "Department" ? "Department" : "General",
    department: typeof raw.department === "string" ? raw.department : null,
    branchScope: deserializeScopeList(raw.branchScope, ["ALL"]),
    departmentScope: deserializeScopeList(
      raw.departmentScope,
      typeof raw.department === "string" && raw.department
        ? [String(raw.department).toUpperCase()]
        : ["ALL"],
    ),
    isMandatory: !!raw.isMandatory,
    allowDownload: !!raw.allowDownload,
    storageType: raw.storageType === "Local" ? "Local" : "Drive",
    driveRef: typeof raw.driveRef === "string" ? raw.driveRef : null,
    localFilename: typeof raw.localFilename === "string" ? raw.localFilename : null,
    uploadedBy: String(raw.uploadedBy ?? ""),
    uploadedAt: contentBigInt(raw.uploadedAt),
    viewCount: Number(raw.viewCount ?? 0),
    isArchived: !!raw.isArchived,
  };
}

function deserializeTrainingDocument(raw: Record<string, unknown>): TrainingDocument {
  return {
    id: contentId(raw.id),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    fileUrl: String(raw.fileUrl ?? ""),
    fileType: String(raw.fileType ?? ""),
    category: String(raw.category ?? ""),
    visibleTo: Array.isArray(raw.visibleTo)
      ? (raw.visibleTo as TrainingDocument["visibleTo"])
      : [],
    visibility: raw.visibility === "Department" ? "Department" : "General",
    department: typeof raw.department === "string" ? raw.department : null,
    branchScope: deserializeScopeList(raw.branchScope, ["ALL"]),
    departmentScope: deserializeScopeList(
      raw.departmentScope,
      typeof raw.department === "string" && raw.department
        ? [String(raw.department).toUpperCase()]
        : ["ALL"],
    ),
    isMandatory: !!raw.isMandatory,
    allowDownload: !!raw.allowDownload,
    storageType: raw.storageType === "Local" ? "Local" : "Drive",
    driveRef: typeof raw.driveRef === "string" ? raw.driveRef : null,
    localFilename: typeof raw.localFilename === "string" ? raw.localFilename : null,
    uploadedBy: String(raw.uploadedBy ?? ""),
    uploadedAt: contentBigInt(raw.uploadedAt),
    downloadCount: Number(raw.downloadCount ?? 0),
    isArchived: !!raw.isArchived,
  };
}

function deserializeAuditLog(raw: Record<string, unknown>): AuditLog {
  return {
    id: contentId(raw.id),
    actorId: String(raw.actorId ?? "system"),
    actorName: String(raw.actorName ?? "System"),
    action: String(raw.action ?? ""),
    target: String(raw.target ?? ""),
    ipAddress: String(raw.ipAddress ?? "unknown"),
    timestamp: contentBigInt(raw.timestamp),
  };
}

function replaceSharedAnnouncements(items: AnnouncementWithPoll[]) {
  _announcements.splice(0, _announcements.length, ...items);
  persistContentCache(ANNOUNCEMENTS_STORE_KEY, _announcements);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ANNOUNCEMENTS_UPDATED_EVENT));
  }
}

function replaceSharedForms(items: PortalForm[]) {
  _forms.splice(0, _forms.length, ...items);
  persistContentCache(FORMS_STORE_KEY, _forms);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FORMS_UPDATED_EVENT));
  }
}

function replaceSharedTrainingVideos(items: TrainingVideo[]) {
  _trainingVideos.splice(0, _trainingVideos.length, ...items);
  persistContentCache(TRAINING_VIDEOS_STORE_KEY, _trainingVideos);
}

function replaceSharedTrainingDocuments(items: TrainingDocument[]) {
  _trainingDocuments.splice(0, _trainingDocuments.length, ...items);
  persistContentCache(TRAINING_DOCUMENTS_STORE_KEY, _trainingDocuments);
}

function getDismissalStore(): Record<string, number[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ANNOUNCEMENT_DISMISS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number[]>;
  } catch {
    return {};
  }
}

function saveDismissalStore(store: Record<string, number[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANNOUNCEMENT_DISMISS_KEY, JSON.stringify(store));
}

function getDismissedAnnouncementIds(userId: string | undefined) {
  if (!userId) return new Set<number>();
  const store = getDismissalStore();
  return new Set(store[userId] ?? []);
}

function addDismissedAnnouncement(userId: string, announcementId: number) {
  const store = getDismissalStore();
  const current = new Set(store[userId] ?? []);
  current.add(announcementId);
  store[userId] = Array.from(current);
  saveDismissalStore(store);
}

function verificationCodeFor(email: string) {
  const seed = Array.from(email).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return String((seed % 900000) + 100000);
}

function roleFromRegistration(req: RegisterRequest): User["role"] {
  if (req.department === "IT") return "SuperAdmin";
  if (req.department === "HR") return "HRAdmin";
  return "GeneralStaff";
}

function roleFromDepartment(department: string): User["role"] {
  if (department === "IT") return "SuperAdmin";
  if (department === "HR") return "HRAdmin";
  return "GeneralStaff";
}

function isPortalStaff(user: User) {
  return !["MASTER ADMIN", "System Admin"].includes(user.fullname);
}

function normalizedScope(values: string[] | null | undefined, fallback: string[] = ["ALL"]) {
  const normalized = (values ?? [])
    .map((value) => String(value ?? "").trim().toUpperCase())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : [...fallback];
}

export function userHasPermission(
  user: User | null | undefined,
  permission: keyof UserPermissions,
): boolean {
  if (!user) return false;
  if (user.role === "SuperAdmin" || user.role === "HRAdmin") return true;
  return !!user.permissions?.[permission];
}

export function getManageableBranches(user: User | null | undefined): string[] {
  if (!user) return [];
  if (user.role === "SuperAdmin" || user.role === "HRAdmin") {
    return [...BRANCHES];
  }
  const scope = normalizedScope(user.managedBranches, []);
  return scope.includes("ALL")
    ? [...BRANCHES]
    : BRANCHES.filter((branch) => scope.includes(branch.toUpperCase()));
}

export function getManageableDepartmentsForBranch(
  user: User | null | undefined,
  branch: string,
): string[] {
  if (!user) return [];
  if (user.role === "SuperAdmin" || user.role === "HRAdmin") {
    return [...DEPARTMENTS];
  }
  const branchKey = branch.trim().toUpperCase();
  const departments = user.managedDepartmentsByBranch?.[branchKey] ?? [];
  const scope = normalizedScope(departments, []);
  return scope.includes("ALL")
    ? [...DEPARTMENTS]
    : DEPARTMENTS.filter((department) => scope.includes(department.toUpperCase()));
}

export function canManageAllDepartmentsForBranch(
  user: User | null | undefined,
  branch: string,
): boolean {
  if (!user) return false;
  if (user.role === "SuperAdmin" || user.role === "HRAdmin") return true;
  if (branch.trim().toUpperCase() === "ALL") return false;
  return getManageableDepartmentsForBranch(user, branch).length === DEPARTMENTS.length;
}

export function formatAudienceSummary(
  branchScope: string[] | null | undefined,
  departmentScope: string[] | null | undefined,
): string {
  const branches = normalizedScope(branchScope, ["ALL"]);
  const departments = normalizedScope(departmentScope, ["ALL"]);
  const branchLabel = branches.includes("ALL") ? "All branches" : branches.join(", ");
  let departmentLabel = "All departments";
  if (!departments.includes("ALL")) {
    departmentLabel =
      departments.length === 1
        ? `${departments[0]} only`
        : `${departments.join(", ")} only`;
  }
  return `Visible to: ${branchLabel} > ${departmentLabel}`;
}

export function getScopeCoverageWarning(
  user: User | null | undefined,
  branch: string,
  department: string,
): string | null {
  if (!user || user.role === "SuperAdmin" || user.role === "HRAdmin") {
    return null;
  }
  if (!branch || branch.trim().toUpperCase() === "ALL") {
    return "This supervisor cannot post to all branches. Choose one assigned branch.";
  }
  const manageableDepartments = getManageableDepartmentsForBranch(user, branch);
  if (manageableDepartments.length === 0) {
    return `No departments are assigned for ${branch} yet. Add department access before posting there.`;
  }
  if (department.trim().toUpperCase() === "ALL" && manageableDepartments.length < DEPARTMENTS.length) {
    return `This supervisor has partial department access in ${branch}: ${manageableDepartments.join(", ")}.`;
  }
  return null;
}

export function formatManageableScopeSummary(user: User | null | undefined): string | null {
  if (!user || user.role !== "Supervisor") return null;
  const branches = getManageableBranches(user);
  if (branches.length === 0) return "Supervisor scope is not assigned yet.";
  return branches
    .map((branch) =>
      formatAudienceSummary(
        [branch],
        getManageableDepartmentsForBranch(user, branch).length === DEPARTMENTS.length
          ? ["ALL"]
          : getManageableDepartmentsForBranch(user, branch),
      ).replace("Visible to:", "Acting scope:"),
    )
    .join(" | ");
}

export function userCanManageScopedItem(
  user: User | null | undefined,
  item: {
    branchScope?: string[] | null;
    departmentScope?: string[] | null;
  },
  permission: keyof UserPermissions,
): boolean {
  if (!userHasPermission(user, permission)) return false;
  if (!user) return false;
  if (user.role === "SuperAdmin" || user.role === "HRAdmin") return true;
  const branches = normalizedScope(item.branchScope, ["ALL"]);
  const departments = normalizedScope(item.departmentScope, ["ALL"]);
  if (branches.includes("ALL")) return false;
  return branches.every((branch) => {
    const branchKey = branch.toUpperCase();
    const manageableBranches = getManageableBranches(user).map((value) =>
      value.toUpperCase(),
    );
    if (!manageableBranches.includes(branchKey)) return false;
    const manageableDepartments = getManageableDepartmentsForBranch(user, branchKey).map(
      (value) => value.toUpperCase(),
    );
    if (departments.includes("ALL")) {
      return manageableDepartments.length === DEPARTMENTS.length;
    }
    return departments.every((department) =>
      manageableDepartments.includes(department.toUpperCase()),
    );
  });
}

function userMatchesScopedItem(
  user: User | null | undefined,
  item: {
    branchScope?: string[] | null;
    departmentScope?: string[] | null;
    visibility?: "General" | "Department";
    department?: string | null;
  },
) {
  if (!user) return false;
  const branchScope = normalizedScope(item.branchScope, ["ALL"]);
  const derivedDepartmentScope =
    item.departmentScope && item.departmentScope.length > 0
      ? item.departmentScope
      : item.visibility === "Department" && item.department
        ? [item.department]
        : ["ALL"];
  const departmentScope = normalizedScope(derivedDepartmentScope, ["ALL"]);
  const branchMatches =
    branchScope.includes("ALL") ||
    branchScope.includes(user.branch.trim().toUpperCase());
  const departmentMatches =
    departmentScope.includes("ALL") ||
    departmentScope.includes(user.department.trim().toUpperCase());
  return branchMatches && departmentMatches;
}

export async function apiRegister(
  req: RegisterRequest,
): Promise<ApiResult<User>> {
  await delay(600);
  const email = normalizeEmail(req.email);
  if (!email.endsWith(OFFICIAL_EMAIL_DOMAIN)) {
    return err("Please use your official Bawjiase email address.");
  }
  if (req.department === "IT" && IT_ACCESS_CODE && req.accessCode !== IT_ACCESS_CODE) {
    return err("Incorrect IT access code. Registration blocked.");
  }
  if (req.department === "HR" && HR_ACCESS_CODE && req.accessCode !== HR_ACCESS_CODE) {
    return err("Incorrect HR access code. Registration blocked.");
  }

  try {
    const payload = await postMailApiJson("/auth/register", {
      fullname: req.fullname,
      phone: req.phone,
      email,
      passwordHash: req.passwordHash,
      position: req.position,
      department: req.department,
      branch: req.branch,
      accessCode: req.accessCode,
    });
    const rawUser = payload.user as WireUser | undefined;
    if (!rawUser) {
      return err("Registration failed");
    }
    return ok(deserializeUser(rawUser));
  } catch (error) {
    return err(error instanceof Error ? error.message : "Registration failed");
  }
}

export async function apiVerifyEmail(
  email: string,
  code: string,
): Promise<ApiResult<null>> {
  await delay(400);
  const normalizedEmail = normalizeEmail(email);
  try {
    const payload = await postMailApiJson("/auth/verify-email", {
      email: normalizedEmail,
      code,
    });
    const rawUser = payload.user as WireUser | undefined;
    if (rawUser) {
      upsertCachedUser(deserializeUser(rawUser));
    }
    return ok(null);
  } catch (error) {
    return err(
      error instanceof Error ? error.message : "Email verification failed",
    );
  }
}

export async function apiResendCode(email: string): Promise<ApiResult<null>> {
  await delay(300);
  const normalizedEmail = normalizeEmail(email);
  try {
    await postMailApi("/auth/resend-verification", { email: normalizedEmail });
    return ok(null);
  } catch (error) {
    return err(
      error instanceof Error ? error.message : "Email could not be sent",
    );
  }
}

export async function apiLogin(
  email: string,
  passwordHash: string,
): Promise<ApiResult<User>> {
  await delay(700);
  const normalizedEmail = normalizeEmail(email);
  try {
    const payload = await postMailApiJson("/auth/login", {
      email: normalizedEmail,
      passwordHash,
    });
    const rawUser = payload.user as WireUser | undefined;
    if (!rawUser) {
      return err("Invalid email or password");
    }
    const user = deserializeUser(rawUser);
    const sessionToken =
      typeof payload.sessionToken === "string" ? payload.sessionToken : "";
    if (!sessionToken) {
      return err("Authentication service unavailable. Please try again.");
    }
    user.sessionToken = sessionToken;
    user.isOnlineNow = true;
    const sharedLastSeen = await pingSharedPresence(user.id);
    if (sharedLastSeen) {
      user.lastSeen = sharedLastSeen;
    }
    upsertCachedUser(user);
    return ok(user);
  } catch (error) {
    return err(
      error instanceof Error
        ? error.message
        : "Authentication service unavailable. Please try again.",
    );
  }
}

export async function apiUpdateLastSeen(
  userId: string,
): Promise<ApiResult<User>> {
  await delay(120);
  await refreshUsersCache();
  const user = _mockUsers.find((item) => item.id === userId && item.isActive);
  if (!user || user.isArchived) return err("User not found");
  user.lastSeen = currentPresenceTimestampMs();
  user.isOnlineNow = true;
  const sharedLastSeen = await pingSharedPresence(userId);
  if (sharedLastSeen) {
    user.lastSeen = sharedLastSeen;
  }
  persistUsersStore(false);
  return ok({ ...user });
}

export async function apiLogout(
  userId?: string,
  sessionTokenOverride?: string | null,
): Promise<void> {
  if (userId) {
    await refreshUsersCache();
    const user = _mockUsers.find((item) => item.id === userId);
    if (user) {
      user.isOnlineNow = false;
      persistUsersStore(false);
    }
    await logoutSharedPresence(userId, sessionTokenOverride);
  }
  try {
    await postKeepaliveApi("/auth/logout", {}, sessionTokenOverride);
  } catch {
    // Ignore logout API failures so the local session can still clear.
  }
}

export async function apiRequestPasswordReset(
  email: string,
): Promise<ApiResult<string>> {
  await delay(500);
  const normalizedEmail = normalizeEmail(email);
  try {
    const resetPageUrl = new URL(withBase("reset-password"), window.location.origin).toString();
    await postMailApi("/auth/request-password-reset", {
      email: normalizedEmail,
      resetPageUrl,
    });
    return ok("Password reset link sent to your email");
  } catch (error) {
    return err(
      error instanceof Error ? error.message : "Email could not be sent",
    );
  }
}

export async function apiConfirmPasswordReset(
  token: string,
  newPasswordHash: string,
): Promise<ApiResult<null>> {
  await delay(500);
  try {
    await postMailApi("/auth/password-reset", { token, newPasswordHash });
    return ok(null);
  } catch (error) {
    return err(
      error instanceof Error ? error.message : "Password reset could not be saved",
    );
  }
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function apiGetMyProfile(userId: string): Promise<User | null> {
  const user = await fetchUserById(userId);
  persistUsersStore();
  return user ? { ...user } : null;
}

export async function apiUpdateMyProfile(
  userId: string,
  req: UpdateProfileRequest,
): Promise<ApiResult<User>> {
  try {
    const payload = await postMailApiJson(
      `/users/${encodeURIComponent(userId)}/profile`,
      { ...req },
    );
    const rawUser = payload.user as WireUser | undefined;
  if (!rawUser) {
    return err("User not found");
  }
  const user = deserializeUser(rawUser);
  rememberRecentUserOverride(user);
  upsertCachedUser(user);
  apiRecordActivity(
    "Profile updated",
    `${user.fullname} profile details were saved.`,
  );
  return ok(user);
  } catch (error) {
    return err(error instanceof Error ? error.message : "User not found");
  }
}

// ── Staff ─────────────────────────────────────────────────────────────────────

export async function apiGetActiveStaff(): Promise<User[]> {
  await refreshUsersCache();
  persistUsersStore();
  return _mockUsers
    .filter((u) => isPortalStaff(u) && !u.isArchived && u.isActive)
    .sort(
      (a, b) =>
        a.department.localeCompare(b.department) ||
        a.fullname.localeCompare(b.fullname),
    );
}

export function apiGetCachedActiveStaff(): User[] {
  return _mockUsers
    .filter((u) => isPortalStaff(u) && !u.isArchived && u.isActive)
    .sort(
      (a, b) =>
        a.department.localeCompare(b.department) ||
        a.fullname.localeCompare(b.fullname),
    );
}

export async function apiGetArchivedStaff(): Promise<User[]> {
  try {
    const payload = await getMailApiJson("/staff/archived");
    const users = (Array.isArray(payload.users) ? (payload.users as WireUser[]) : [])
      .map(deserializeUser)
      .filter((user) => isPortalStaff(user))
      .sort((a, b) => a.fullname.localeCompare(b.fullname));
    _mockUsers = users.concat(
      _mockUsers.filter((user) => !users.some((item) => item.id === user.id)),
    );
    persistUsersStore();
    return users;
  } catch {
    return _mockUsers
      .filter((u) => isPortalStaff(u) && u.isArchived)
      .sort((a, b) => a.fullname.localeCompare(b.fullname));
  }
}

export function apiGetCachedArchivedStaff(): User[] {
  return _mockUsers
    .filter((u) => isPortalStaff(u) && u.isArchived)
    .sort((a, b) => a.fullname.localeCompare(b.fullname));
}

export async function apiGetStaffMember(userId: string): Promise<User | null> {
  await refreshUsersCache();
  return fetchUserById(userId);
}

export async function apiUpdateStaff(
  userId: string,
  req: UpdateStaffRequest,
): Promise<ApiResult<User>> {
  try {
    const payload = await postMailApiJson(
      `/staff/${encodeURIComponent(userId)}/update`,
      { ...req },
    );
    const rawUser = payload.user as WireUser | undefined;
  if (!rawUser) {
    return err("Staff member not found");
  }
  const user = deserializeUser(rawUser);
  rememberRecentUserOverride(user);
  upsertCachedUser(user);
  apiRecordActivity(
    "Staff updated",
    `${user.fullname} is now assigned to ${user.department} at ${user.branch}.`,
  );
  return ok(user);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Staff member not found");
  }
}

export async function apiArchiveStaff(
  userId: string,
): Promise<ApiResult<null>> {
  try {
    await postMailApi(`/staff/${encodeURIComponent(userId)}/archive`, {});
    await refreshUsersCache();
    apiRecordActivity("Staff archived", "A staff member was moved to Past Staff.");
    return ok(null);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Staff member not found");
  }
}

export async function apiRestoreStaff(
  userId: string,
): Promise<ApiResult<null>> {
  try {
    await postMailApi(`/staff/${encodeURIComponent(userId)}/restore`, {});
    await refreshUsersCache();
    apiRecordActivity("Staff restored", "A past staff record was restored.");
    return ok(null);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Staff member not found");
  }
}

export async function apiDeleteStaff(userId: string): Promise<ApiResult<null>> {
  await delay(300);
  try {
    await postMailApi(`/staff/${encodeURIComponent(userId)}/delete`, {});
    _mockUsers = _mockUsers.filter((user) => user.id !== userId);
    persistUsersStore();
    apiRecordActivity(
      "Past staff deleted",
      "A past staff record was removed permanently.",
    );
    return ok(null);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Staff member not found");
  }
}

export async function apiGetStaffStats(): Promise<StaffStats> {
  await delay(300);
  try {
    const payload = await getMailApiJson("/staff/stats");
    return {
      total: Number(payload.total ?? 0),
      active: Number(payload.active ?? 0),
      archived: Number(payload.archived ?? 0),
      byDepartment: (payload.byDepartment as Record<string, number>) ?? {},
      byBranch: (payload.byBranch as Record<string, number>) ?? {},
      byRole: (payload.byRole as Record<string, number>) ?? {},
    };
  } catch {
    const active = _mockUsers.filter((u) => !u.isArchived && u.isActive);
    const byDept: Record<string, number> = {};
    const byBranch: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    for (const u of active) {
      byDept[u.department] = (byDept[u.department] ?? 0) + 1;
      byBranch[u.branch] = (byBranch[u.branch] ?? 0) + 1;
      byRole[u.role] = (byRole[u.role] ?? 0) + 1;
    }
    return {
      total: _mockUsers.length,
      active: active.length,
      archived: _mockUsers.filter((u) => u.isArchived).length,
      byDepartment: byDept,
      byBranch: byBranch,
      byRole: byRole,
    };
  }
}

export async function apiGetDashboardOverview(): Promise<DashboardOverview> {
  await delay(350);
  await refreshUsersCache();
  try {
    const payload = await getMailApiJson("/content/announcements");
    const sharedItems = Array.isArray(payload.announcements)
      ? (payload.announcements as Array<Record<string, unknown>>).map(deserializeAnnouncement)
      : [];
    replaceSharedAnnouncements(sharedItems);
  } catch {
    // Keep local seeded content if shared announcements are unavailable.
  }
  const activeStaff = _mockUsers.filter(
    (u) =>
      u.isActive &&
      !u.isArchived &&
      !["MASTER ADMIN", "System Admin"].includes(u.fullname),
  );
  const branchOrder = [
    "HEAD OFFICE",
    "BAWJIASE",
    "ADEISO",
    "OFAAKOR",
    "KASOA NEW MARKET",
    "KASOA MAIN",
  ];
  const branchCounts = new Map<string, number>(
    branchOrder.map((branch) => [branch, 0]),
  );
  const departmentCounts = new Map<string, number>();

  for (const user of activeStaff) {
    const branch = user.branch.trim().toUpperCase();
    branchCounts.set(branch, (branchCounts.get(branch) ?? 0) + 1);
    if (user.role !== "SuperAdmin") {
      const department = user.department.trim().toUpperCase() || "OTHER";
      departmentCounts.set(
        department,
        (departmentCounts.get(department) ?? 0) + 1,
      );
    }
  }

  const branchDistribution = branchOrder.map((name) => ({
    name,
    value: branchCounts.get(name) ?? 0,
  }));
  const departmentDistribution = [...departmentCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));
  const supportPending =
    _incidents.filter((i) => i.status !== "resolved").length +
    _amendments.filter((a) => a.status === "pending").length;
  const supportResolved =
    _incidents.filter((i) => i.status === "resolved").length +
    _amendments.filter((a) => a.status !== "pending").length;
  const ticketFlow = supportPending + supportResolved;
  const topBranch = branchDistribution.reduce(
    (best, item) => (item.value > best.value ? item : best),
    { name: "No Active Branch", value: 0 },
  );
  const topDepartment = departmentDistribution.reduce(
    (best, item) => (item.value > best.value ? item : best),
    { name: "No Active Department", value: 0 },
  );

  return {
    totalStaff: activeStaff.length,
    activeBranches: branchDistribution.filter((item) => item.value > 0).length,
    openOperations: supportPending,
    resolutionRate: ticketFlow
      ? Math.round((supportResolved / ticketFlow) * 100)
      : 0,
    resolvedCount: supportResolved,
    newsTotal: _announcements.filter((a) => !a.isTrashed).length,
    topBranch: topBranch.name,
    topBranchCount: topBranch.value,
    topDepartment: topDepartment.name,
    topDepartmentCount: topDepartment.value,
    branchDistribution,
    departmentDistribution:
      departmentDistribution.length > 0
        ? departmentDistribution
        : [{ name: "No Data", value: 0 }],
    supportPending,
    supportResolved,
  };
}

export function apiGetCachedDashboardOverview(): DashboardOverview {
  const activeStaff = _mockUsers.filter(
    (u) =>
      u.isActive &&
      !u.isArchived &&
      !["MASTER ADMIN", "System Admin"].includes(u.fullname),
  );
  const branchOrder = [
    "HEAD OFFICE",
    "BAWJIASE",
    "ADEISO",
    "OFAAKOR",
    "KASOA NEW MARKET",
    "KASOA MAIN",
  ];
  const branchCounts = new Map<string, number>(
    branchOrder.map((branch) => [branch, 0]),
  );
  const departmentCounts = new Map<string, number>();

  for (const user of activeStaff) {
    const branch = user.branch.trim().toUpperCase();
    branchCounts.set(branch, (branchCounts.get(branch) ?? 0) + 1);
    if (user.role !== "SuperAdmin") {
      const department = user.department.trim().toUpperCase() || "OTHER";
      departmentCounts.set(
        department,
        (departmentCounts.get(department) ?? 0) + 1,
      );
    }
  }

  const branchDistribution = branchOrder.map((name) => ({
    name,
    value: branchCounts.get(name) ?? 0,
  }));
  const departmentDistribution = [...departmentCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));
  const supportPending =
    _incidents.filter((i) => i.status !== "resolved").length +
    _amendments.filter((a) => a.status === "pending").length;
  const supportResolved =
    _incidents.filter((i) => i.status === "resolved").length +
    _amendments.filter((a) => a.status !== "pending").length;
  const ticketFlow = supportPending + supportResolved;
  const topBranch = branchDistribution.reduce(
    (best, item) => (item.value > best.value ? item : best),
    { name: "No Active Branch", value: 0 },
  );
  const topDepartment = departmentDistribution.reduce(
    (best, item) => (item.value > best.value ? item : best),
    { name: "No Active Department", value: 0 },
  );

  return {
    totalStaff: activeStaff.length,
    activeBranches: branchDistribution.filter((item) => item.value > 0).length,
    openOperations: supportPending,
    resolutionRate: ticketFlow
      ? Math.round((supportResolved / ticketFlow) * 100)
      : 0,
    resolvedCount: supportResolved,
    newsTotal: _announcements.filter((a) => !a.isTrashed).length,
    topBranch: topBranch.name,
    topBranchCount: topBranch.value,
    topDepartment: topDepartment.name,
    topDepartmentCount: topDepartment.value,
    branchDistribution,
    departmentDistribution:
      departmentDistribution.length > 0
        ? departmentDistribution
        : [{ name: "No Data", value: 0 }],
    supportPending,
    supportResolved,
  };
}

// ── Announcements ─────────────────────────────────────────────────────────────

const SEEDED_ANNOUNCEMENTS: AnnouncementWithPoll[] = [
  {
    id: 1,
    title: "BCB Annual General Meeting 2026",
    content:
      "All staff are cordially invited to the Annual General Meeting scheduled for Friday, 24 April 2026 at the Head Office auditorium at 10:00 AM. Attendance is mandatory for all department heads.",
    category: "HR",
    imageUrl: null,
    fileUrl: null,
    attachmentName: null,
    allowDownload: true,
    authorId: "mock-user-1",
    authorName: "Sarah Mensah",
    createdAt: BigInt(Date.now() - 86400000),
    updatedAt: BigInt(Date.now() - 86400000),
    isDismissed: false,
    isTrashed: false,
    poll: {
      id: 1,
      question: "Will you attend in person or virtually?",
      options: [
        { id: 1, text: "In Person", votes: 34 },
        { id: 2, text: "Virtually", votes: 12 },
        { id: 3, text: "I cannot attend", votes: 5 },
      ],
      totalVotes: 51,
      userVotedOptionId: null,
      endDate: BigInt(Date.now() + 259200000),
      isActive: true,
    },
  },
  {
    id: 2,
    title: "New Farm Loan Policy Effective May 2026",
    content:
      "The Credit Department has updated the farm loan policy. All loan officers should review the new guidelines before processing any farm loan applications from 1 May 2026.",
    category: "HR",
    imageUrl: null,
    fileUrl: null,
    attachmentName: null,
    allowDownload: true,
    authorId: "mock-user-1",
    authorName: "Sarah Mensah",
    createdAt: BigInt(Date.now() - 172800000),
    updatedAt: BigInt(Date.now() - 172800000),
    isDismissed: false,
    isTrashed: false,
    poll: null,
  },
  {
    id: 3,
    title: "Mandatory IT Security Training - All Staff",
    content:
      "The IT Department has scheduled a mandatory cybersecurity awareness training for all staff. Sessions will run from Monday to Wednesday next week. Please confirm your preferred session slot.",
    category: "IT",
    imageUrl: null,
    fileUrl: null,
    attachmentName: null,
    allowDownload: true,
    authorId: "mock-user-2",
    authorName: "Emmanuel Asante",
    createdAt: BigInt(Date.now() - 259200000),
    updatedAt: BigInt(Date.now() - 259200000),
    isDismissed: false,
    isTrashed: false,
    poll: null,
  },
];

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  category: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
  attachmentName?: string | null;
  allowDownload?: boolean;
  pollQuestion?: string;
  pollOptions?: string[];
  branchScope?: string[];
  departmentScope?: string[];
  visibility?: "General" | "Department";
  department?: string | null;
}

export interface UpdateAnnouncementRequest
  extends Partial<CreateAnnouncementRequest> {}

const _announcements: AnnouncementWithPoll[] = loadContentCache(
  ANNOUNCEMENTS_STORE_KEY,
  SEEDED_ANNOUNCEMENTS,
  deserializeAnnouncement,
);
let _announcementIdCounter = Math.max(0, ..._announcements.map((item) => item.id)) + 1;
let _pollIdCounter = 2;
let _pollOptionIdCounter = 4;
const _announcementVotes = new Map<string, number>();

export async function apiGetAnnouncements(
  userId?: string,
): Promise<AnnouncementWithPoll[]> {
  await delay(400);
  try {
    const payload = await getMailApiJson("/content/announcements");
    const sharedItems = Array.isArray(payload.announcements)
      ? (payload.announcements as Array<Record<string, unknown>>).map(deserializeAnnouncement)
      : [];
    replaceSharedAnnouncements(sharedItems);
  } catch {
    if (!ENABLE_SEEDED_FALLBACK) {
      replaceSharedAnnouncements([]);
    }
  }
  const authUser = getStoredAuthUser();
  const dismissedIds = getDismissedAnnouncementIds(userId);
  return _announcements
    .filter((a) => !a.isTrashed && !dismissedIds.has(a.id))
    .filter((a) => userMatchesScopedItem(authUser, a))
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}

export function apiGetCachedAnnouncements(
  userId?: string,
): AnnouncementWithPoll[] {
  const authUser = getStoredAuthUser();
  const dismissedIds = getDismissedAnnouncementIds(userId);
  return _announcements
    .filter((a) => !a.isTrashed && !dismissedIds.has(a.id))
    .filter((a) => userMatchesScopedItem(authUser, a))
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}

export async function apiGetTrashedAnnouncements(): Promise<Announcement[]> {
  await delay(300);
  try {
    const payload = await getMailApiJson("/content/announcements");
    const sharedItems = Array.isArray(payload.announcements)
      ? (payload.announcements as Array<Record<string, unknown>>).map(deserializeAnnouncement)
      : [];
    replaceSharedAnnouncements(sharedItems);
  } catch {
    if (!ENABLE_SEEDED_FALLBACK) {
      replaceSharedAnnouncements([]);
    }
  }
  return _announcements
    .filter((a) => a.isTrashed)
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}

export function apiGetCachedTrashedAnnouncements(): Announcement[] {
  return _announcements
    .filter((a) => a.isTrashed)
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}

export async function apiCreateAnnouncement(
  req: CreateAnnouncementRequest,
  author: Pick<User, "id" | "fullname" | "department">,
): Promise<ApiResult<AnnouncementWithPoll>> {
  const cleanPollOptions = (req.pollOptions ?? [])
    .map((option) => option.trim())
    .filter(Boolean);
  try {
    const payload = await postMailApiJson("/content/announcements", {
      title: req.title.trim(),
      content: req.content.trim(),
      category: req.category.trim() || author.department,
      imageUrl: req.imageUrl ?? null,
      fileUrl: req.fileUrl ?? null,
      attachmentName: req.attachmentName ?? null,
      allowDownload: req.allowDownload ?? true,
      visibility: req.visibility ?? "General",
      department: req.visibility === "Department" ? (req.department ?? null) : null,
      branchScope: req.branchScope ?? ["ALL"],
      departmentScope:
        req.departmentScope ??
        (req.visibility === "Department" && req.department
          ? [req.department]
          : ["ALL"]),
      poll:
        req.pollQuestion?.trim() && cleanPollOptions.length >= 2
          ? {
              id: _pollIdCounter++,
              question: req.pollQuestion.trim(),
              options: cleanPollOptions.map((text) => ({
                id: _pollOptionIdCounter++,
                text,
                votes: 0,
              })),
              totalVotes: 0,
              userVotedOptionId: null,
              endDate: null,
              isActive: true,
            }
          : null,
    });
    const rawAnnouncement = payload.announcement as Record<string, unknown> | undefined;
    if (!rawAnnouncement) return err("Announcement could not be created");
    const announcement = deserializeAnnouncement(rawAnnouncement);
    _announcements.unshift(announcement);
    apiRecordActivity(
      "Announcement posted",
      `${announcement.title} was published to ${formatAudienceSummary(
        announcement.branchScope,
        announcement.departmentScope,
      )}.`,
    );
    return ok(announcement);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Announcement could not be created");
  }
}

export async function apiUpdateAnnouncement(
  id: number,
  req: UpdateAnnouncementRequest,
): Promise<ApiResult<AnnouncementWithPoll>> {
  const announcement = _announcements.find((item) => item.id === id);
  if (!announcement) return err("Announcement not found");
  if (id >= 1000) {
    const cleanPollOptions = (req.pollOptions ?? [])
      .map((option) => option.trim())
      .filter(Boolean);
    try {
      const payload = await postMailApiJson(`/content/announcements/${id}/update`, {
        title: req.title?.trim(),
        content: req.content?.trim(),
        category: req.category?.trim(),
        imageUrl: req.imageUrl,
        fileUrl: req.fileUrl,
        attachmentName: req.attachmentName,
        allowDownload: req.allowDownload,
        poll:
          req.pollQuestion !== undefined || req.pollOptions !== undefined
            ? req.pollQuestion?.trim() && cleanPollOptions.length >= 2
              ? {
                  id: announcement.poll?.id ?? _pollIdCounter++,
                  question: req.pollQuestion.trim(),
                  options: cleanPollOptions.map((text) => ({
                    id: _pollOptionIdCounter++,
                    text,
                    votes: 0,
                  })),
                  totalVotes: 0,
                  userVotedOptionId: null,
                  endDate: null,
                  isActive: true,
                }
              : null
            : undefined,
      });
      const rawAnnouncement = payload.announcement as Record<string, unknown> | undefined;
      if (!rawAnnouncement) return err("Announcement not found");
      const updated = deserializeAnnouncement(rawAnnouncement);
      const idx = _announcements.findIndex((item) => item.id === id);
      if (idx >= 0) _announcements[idx] = updated;
      apiRecordActivity("Announcement updated", `${updated.title} was updated.`);
      return ok(updated);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Announcement not found");
    }
  }

  announcement.title = req.title?.trim() ?? announcement.title;
  announcement.content = req.content?.trim() ?? announcement.content;
  announcement.category = req.category?.trim() ?? announcement.category;
  announcement.imageUrl =
    req.imageUrl === undefined ? announcement.imageUrl : req.imageUrl;
  announcement.fileUrl =
    req.fileUrl === undefined ? announcement.fileUrl : req.fileUrl;
  announcement.attachmentName =
    req.attachmentName === undefined
      ? announcement.attachmentName
      : req.attachmentName;
  announcement.allowDownload =
    req.allowDownload === undefined
      ? announcement.allowDownload
      : req.allowDownload;
  announcement.updatedAt = BigInt(Date.now());

  if (req.pollQuestion !== undefined || req.pollOptions !== undefined) {
    const cleanPollOptions = (req.pollOptions ?? [])
      .map((option) => option.trim())
      .filter(Boolean);
    announcement.poll =
      req.pollQuestion?.trim() && cleanPollOptions.length >= 2
        ? {
            id: announcement.poll?.id ?? _pollIdCounter++,
            question: req.pollQuestion.trim(),
            options: cleanPollOptions.map((text) => ({
              id: _pollOptionIdCounter++,
              text,
              votes: 0,
            })),
            totalVotes: 0,
            userVotedOptionId: null,
            endDate: null,
            isActive: true,
          }
        : null;
  }

  apiRecordActivity("Announcement updated", `${announcement.title} was updated.`);
  return ok(announcement);
}

export async function apiDismissAnnouncement(
  id: number,
  userId: string,
): Promise<ApiResult<null>> {
  await delay(200);
  const announcement = _announcements.find((item) => item.id === id);
  if (!announcement) return err("Announcement not found");
  addDismissedAnnouncement(userId, id);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ANNOUNCEMENTS_UPDATED_EVENT));
  }
  return ok(null);
}

export async function apiTrashAnnouncement(
  id: number,
): Promise<ApiResult<null>> {
  await delay(250);
  const announcement = _announcements.find((item) => item.id === id);
  if (!announcement) return err("Announcement not found");
  if (id >= 1000) {
    try {
      await postMailApi(`/content/announcements/${id}/trash`, {});
      announcement.isTrashed = true;
      replaceSharedAnnouncements([..._announcements]);
      return ok(null);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Announcement not found");
    }
  }
  announcement.isTrashed = true;
  replaceSharedAnnouncements([..._announcements]);
  return ok(null);
}

export async function apiRestoreAnnouncement(
  id: number,
): Promise<ApiResult<null>> {
  await delay(250);
  const announcement = _announcements.find((item) => item.id === id);
  if (!announcement) return err("Announcement not found");
  if (id >= 1000) {
    try {
      await postMailApi(`/content/announcements/${id}/restore`, {});
      announcement.isTrashed = false;
      announcement.isDismissed = false;
      replaceSharedAnnouncements([..._announcements]);
      return ok(null);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Announcement not found");
    }
  }
  announcement.isTrashed = false;
  announcement.isDismissed = false;
  replaceSharedAnnouncements([..._announcements]);
  return ok(null);
}

export async function apiDeleteAnnouncement(
  id: number,
): Promise<ApiResult<null>> {
  await delay(250);
  const index = _announcements.findIndex((item) => item.id === id);
  if (index < 0) return err("Announcement not found");
  if (id >= 1000) {
    try {
      await postMailApi(`/content/announcements/${id}/delete`, {});
    } catch (error) {
      return err(error instanceof Error ? error.message : "Announcement not found");
    }
  }
  _announcements.splice(index, 1);
  replaceSharedAnnouncements([..._announcements]);
  apiRecordActivity("Announcement deleted", "An announcement was deleted.");
  return ok(null);
}

export async function apiEmptyAnnouncementTrash(): Promise<ApiResult<null>> {
  await delay(300);
  try {
    await postMailApi("/content/announcements/empty-trash", {});
  } catch {
    // Keep local cleanup as a fallback.
  }
  for (let index = _announcements.length - 1; index >= 0; index -= 1) {
    if (_announcements[index].isTrashed) {
      _announcements.splice(index, 1);
    }
  }
  replaceSharedAnnouncements([..._announcements]);
  return ok(null);
}

export async function apiVoteAnnouncementPoll(
  pollId: number,
  optionId: number,
  userId: string,
): Promise<ApiResult<NonNullable<AnnouncementWithPoll["poll"]>>> {
  await delay(250);
  const voteKey = `${userId}:${pollId}`;
  if (_announcementVotes.has(voteKey)) {
    return err("You have already voted on this poll");
  }

  const announcement = _announcements.find((item) => item.poll?.id === pollId);
  if (!announcement?.poll) return err("Poll not found");

  const option = announcement.poll.options.find((item) => item.id === optionId);
  if (!option) return err("Poll option not found");

  option.votes += 1;
  announcement.poll.totalVotes += 1;
  announcement.poll.userVotedOptionId = optionId;
  _announcementVotes.set(voteKey, optionId);
  return ok({ ...announcement.poll, options: [...announcement.poll.options] });
}

// ── Notifications ─────────────────────────────────────────────────────────────

let _notifications: Notification[] = loadContentCache(
  NOTIFICATIONS_STORE_KEY,
  [],
  deserializeNotification,
);

export async function apiGetUnreadNotificationCount(): Promise<number> {
  await delay(200);
  try {
    const payload = await getMailApiJson("/notifications/unread-count");
    return Number(payload.count ?? 0);
  } catch {
    return _notifications.filter((n) => !n.isRead).length;
  }
}

export async function apiGetNotifications(): Promise<Notification[]> {
  await delay(300);
  try {
    const payload = await getMailApiJson("/notifications");
    const items = Array.isArray(payload.notifications)
      ? (payload.notifications as Array<Record<string, unknown>>).map(
          deserializeNotification,
        )
      : [];
    _notifications = items;
    persistContentCache(NOTIFICATIONS_STORE_KEY, _notifications);
    return items.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  } catch {
    return [..._notifications].sort(
      (a, b) => Number(b.createdAt) - Number(a.createdAt),
    );
  }
}

export function apiGetCachedNotifications(): Notification[] {
  return [..._notifications].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}

export async function apiMarkNotificationRead(id: number): Promise<boolean> {
  await delay(150);
  try {
    await postMailApi(`/notifications/${id}/read`, {});
  } catch {
    // Fall back to local state below.
  }
  const notif = _notifications.find((n) => n.id === id);
  if (notif) notif.isRead = true;
  persistContentCache(NOTIFICATIONS_STORE_KEY, _notifications);
  return !!notif;
}

export async function apiMarkAllNotificationsRead(): Promise<void> {
  await delay(200);
  try {
    await postMailApi("/notifications/read-all", {});
  } catch {
    // Fall back to local state below.
  }
  for (const n of _notifications) n.isRead = true;
  persistContentCache(NOTIFICATIONS_STORE_KEY, _notifications);
}

export async function apiDeleteNotification(id: number): Promise<boolean> {
  await delay(150);
  try {
    await postMailApi(`/notifications/${id}/delete`, {});
  } catch {
    // Fall back to local state below.
  }
  const idx = _notifications.findIndex((n) => n.id === id);
  if (idx >= 0) {
    _notifications.splice(idx, 1);
    persistContentCache(NOTIFICATIONS_STORE_KEY, _notifications);
    return true;
  }
  return false;
}

// ── Forms Centre ──────────────────────────────────────────────────────────────

const SEEDED_FORMS: PortalForm[] = [
  {
    id: 4,
    title: "OATH OF SECRECY",
    description: "",
    fileUrl: "1Qlab6ipjgP2aw2wOYU1SO99cX8tsf1kj",
    category: "FINANCE",
    visibleTo: [],
    visibility: "General",
    department: null,
    createdAt: BigInt(1767176110787),
    updatedAt: BigInt(1767176110787),
  },
  {
    id: 2,
    title: "CODE OF CONDUCT",
    description: "",
    fileUrl: "1Fu97vLE4A_TAkiwLu__8vNRvsiCudjx7",
    category: "HR",
    visibleTo: [],
    visibility: "General",
    department: null,
    createdAt: BigInt(1767176110787),
    updatedAt: BigInt(1767176110787),
  },
  {
    id: 7,
    title: "CRP TEMPLATE",
    description: "",
    fileUrl:
      "https://docs.google.com/spreadsheets/d/1eBukKjoMlfJijF-h9QBrnDkIyYAc7juZ/edit?usp=sharing&ouid=105604838323272569561&rtpof=true&sd=true",
    category: "HR",
    visibleTo: [],
    visibility: "General",
    department: null,
    createdAt: BigInt(1769219989122),
    updatedAt: BigInt(1769219989122),
  },
  {
    id: 6,
    title: "LEAVE FORM",
    description: "",
    fileUrl: "10XyOJ1tgF0A2F8-ID7wwg6UYSinkWbOQ",
    category: "HR",
    visibleTo: [],
    visibility: "General",
    department: null,
    createdAt: BigInt(1767176116253),
    updatedAt: BigInt(1767176116253),
  },
  {
    id: 3,
    title: "Medical Forms",
    description: "",
    fileUrl: "1iGpcNdrJbPQ0C3PRvs1AW3JXOLK4SRMH",
    category: "HR",
    visibleTo: [],
    visibility: "General",
    department: null,
    createdAt: BigInt(1767176110787),
    updatedAt: BigInt(1767176110787),
  },
  {
    id: 1,
    title: "2025 END OF YEAR APPRAISAL",
    description: "",
    fileUrl: "1x0qDGKMudExHenT46QqCMm8ln0J2RjTE",
    category: "OPERATIONS",
    visibleTo: [],
    visibility: "General",
    department: null,
    createdAt: BigInt(1767176110787),
    updatedAt: BigInt(1767176110787),
  },
  {
    id: 5,
    title: "STAFF FAMILY FORM",
    description: "",
    fileUrl: "1LxW2ERPBr6N8qwb4yQ22jy8B-4OO2qZ5",
    category: "SUSU",
    visibleTo: [],
    visibility: "General",
    department: null,
    createdAt: BigInt(1767176110787),
    updatedAt: BigInt(1767176110787),
  },
];

let _forms: PortalForm[] = loadContentCache(
  FORMS_STORE_KEY,
  SEEDED_FORMS,
  deserializeForm,
);

let _formIdCounter = Math.max(0, ..._forms.map((form) => form.id)) + 1;

export interface CreateFormRequest {
  title: string;
  description: string;
  fileUrl: string;
  category: string;
  visibleTo: PortalForm["visibleTo"];
  visibility?: PortalForm["visibility"];
  department?: string | null;
  branchScope?: string[];
  departmentScope?: string[];
  sendExternalEmails?: boolean;
}

function canManageForms(user?: User | null) {
  return userHasPermission(user, "forms");
}

function canUserSeeForm(form: PortalForm, user?: User | null) {
  return userMatchesScopedItem(user, form);
}

export function apiExtractDriveFileId(driveRef: string): string {
  const value = driveRef.trim();
  if (!value) return "";
  if (!value.includes("drive.google.com")) return value;
  if (value.includes("/d/")) {
    return value.split("/d/")[1].split("/")[0].split("?")[0];
  }
  if (value.includes("id=")) {
    return value.split("id=")[1].split("&")[0];
  }
  return value;
}

export function apiOpenFormUrl(fileRef: string): string {
  const value = fileRef.trim();
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://drive.google.com/file/d/${value}/view`;
}

export function apiDownloadFormUrl(fileRef: string): string {
  const value = fileRef.trim();
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://drive.google.com/uc?export=download&id=${value}`;
}

export async function apiGetForms(user?: User | null): Promise<PortalForm[]> {
  await delay(350);
  try {
    const payload = await getMailApiJson("/content/forms");
    const sharedItems = Array.isArray(payload.forms)
      ? (payload.forms as Array<Record<string, unknown>>).map(deserializeForm)
      : [];
    replaceSharedForms(sharedItems);
  } catch {
    if (!ENABLE_SEEDED_FALLBACK) {
      replaceSharedForms([]);
    }
  }
  return _forms
    .filter((form) => canUserSeeForm(form, user))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
    );
}

export function apiGetCachedForms(user?: User | null): PortalForm[] {
  return _forms
    .filter((form) => canUserSeeForm(form, user))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
    );
}

export async function apiCreateForm(
  req: CreateFormRequest,
): Promise<ApiResult<PortalForm>> {
  await delay(400);
  try {
    const payload = await postMailApiJson("/content/forms", {
      title: req.title,
      description: req.description,
      fileUrl: apiExtractDriveFileId(req.fileUrl),
      category: req.category,
      visibleTo: [],
      visibility: req.visibility ?? "General",
      department:
        req.visibility === "Department" ? (req.department ?? null) : null,
      branchScope: req.branchScope ?? ["ALL"],
      departmentScope:
        req.departmentScope ??
        (req.visibility === "Department" && req.department
          ? [req.department]
          : ["ALL"]),
      sendExternalEmails: !!req.sendExternalEmails,
    });
    const rawForm = payload.form as Record<string, unknown> | undefined;
    if (!rawForm) return err("Form could not be created");
    const form = deserializeForm(rawForm);
    _forms.unshift(form);
    apiRecordActivity(
      "Form uploaded",
      `${form.title} was added for ${formatAudienceSummary(
        form.branchScope,
        form.departmentScope,
      )}.`,
    );
    return ok(form);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Form could not be created");
  }
}

export async function apiUpdateForm(
  id: number,
  req: Partial<CreateFormRequest>,
): Promise<ApiResult<PortalForm>> {
  await delay(350);
  const idx = _forms.findIndex((f) => f.id === id);
  if (idx < 0) return err("Form not found");
  if (id >= 1000) {
    try {
      const payload = await postMailApiJson(`/content/forms/${id}/update`, {
        ...req,
        fileUrl: req.fileUrl ? apiExtractDriveFileId(req.fileUrl) : undefined,
        branchScope: req.branchScope,
        departmentScope: req.departmentScope,
      });
      const rawForm = payload.form as Record<string, unknown> | undefined;
      if (!rawForm) return err("Form not found");
      const form = deserializeForm(rawForm);
      _forms[idx] = form;
      apiRecordActivity("Form updated", `${form.title} was updated.`);
      return ok(form);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Form not found");
    }
  }
  _forms[idx] = {
    ..._forms[idx],
    ...req,
    fileUrl: req.fileUrl
      ? apiExtractDriveFileId(req.fileUrl)
      : _forms[idx].fileUrl,
    department:
      req.visibility === "Department"
        ? (req.department ?? _forms[idx].department ?? null)
        : req.visibility === "General"
          ? null
          : _forms[idx].department,
    updatedAt: BigInt(Date.now()),
  };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FORMS_UPDATED_EVENT));
  }
  apiRecordActivity("Form updated", `${_forms[idx].title} was updated.`);
  return ok(_forms[idx]);
}

export async function apiDeleteForm(id: number): Promise<ApiResult<null>> {
  await delay(300);
  const idx = _forms.findIndex((f) => f.id === id);
  if (idx < 0) return err("Form not found");
  if (id >= 1000) {
    try {
      await postMailApi(`/content/forms/${id}/delete`, {});
    } catch (error) {
      return err(error instanceof Error ? error.message : "Form not found");
    }
  }
  _forms.splice(idx, 1);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FORMS_UPDATED_EVENT));
  }
  apiRecordActivity("Form deleted", "A form was removed from the library.");
  return ok(null);
}

// ── Training ──────────────────────────────────────────────────────────────────

export interface UploadVideoRequest {
  title: string;
  description: string;
  videoUrl: string;
  storageType: "Drive" | "Local";
  visibility: "General" | "Department";
  department?: string;
  branchScope?: string[];
  departmentScope?: string[];
  mandatory?: boolean;
  allowDownload?: boolean;
  sendExternalEmails?: boolean;
}

export interface UploadDocumentRequest {
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  storageType: "Drive" | "Local";
  visibility: "General" | "Department";
  department?: string;
  branchScope?: string[];
  departmentScope?: string[];
  mandatory?: boolean;
  allowDownload?: boolean;
  sendExternalEmails?: boolean;
}

export interface VideoProgress {
  videoId: number;
  progressPercent: number;
  isComplete: boolean;
  lastWatched: bigint;
}

export interface VideoWatchStat {
  videoId: number;
  title: string;
  totalWatched: number;
  completedCount: number;
}

export interface AdminTrainingOverview {
  totalVideos: number;
  totalDocuments: number;
  totalStaff: number;
  videoStats: {
    id: number;
    title: string;
    eligibleCount: number;
    watchedCount: number;
    completionPct: number;
    isMandatory: boolean;
    branchScope?: string[];
    departmentScope?: string[];
    incompleteUsers: string[];
  }[];
  docStats: {
    id: number;
    title: string;
    eligibleCount: number;
    openedCount: number;
    openedPct: number;
    isMandatory: boolean;
    branchScope?: string[];
    departmentScope?: string[];
    incompleteUsers: string[];
  }[];
}

function getStoredAuthUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    parsed.lastSeen = BigInt(parsed.lastSeen ?? 0);
    parsed.registrationTime = BigInt(parsed.registrationTime ?? 0);
    return parsed;
  } catch {
    return null;
  }
}

function getPortalActiveUsers() {
  return _mockUsers.filter(
    (u) => isPortalStaff(u) && u.isActive && !u.isArchived,
  );
}

function isTrainingManager(user: User | null | undefined) {
  return (
    userHasPermission(user, "trainingVideos") ||
    userHasPermission(user, "trainingDocuments")
  );
}

function extractDriveId(input: string): string {
  const trimmed = input.trim();
  const match =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ??
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? trimmed.replace(/^DRIVE:/, "");
}

function isGoogleDocUrl(input: string) {
  return /docs\.google\.com/i.test(input.trim());
}

function localAssetUrl(ref: string) {
  const filename = ref.replace(/^LOCAL:/, "").trim();
  return filename
    ? `${withSessionToken(`${MAIL_API_ROOT}/uploads/${filename}`)}&_v=${encodeURIComponent(ref)}`
    : "";
}

export async function apiUploadTrainingVideoFile(
  file: File,
): Promise<{ filename: string; url: string }> {
  const payload = await uploadMailApiFile("/uploads/training-video", file);
  return {
    filename: String(payload.filename ?? ""),
    url: String(payload.url ?? ""),
  };
}

export async function apiUploadTrainingDocumentFile(
  file: File,
): Promise<{ filename: string; url: string }> {
  const payload = await uploadMailApiFile("/uploads/training-document", file);
  return {
    filename: String(payload.filename ?? ""),
    url: String(payload.url ?? ""),
  };
}

export async function apiUploadAnnouncementAssetFile(
  file: File,
): Promise<{ filename: string; url: string }> {
  const payload = await uploadMailApiFile("/uploads/announcement-asset", file);
  return {
    filename: String(payload.filename ?? ""),
    url: String(payload.url ?? ""),
  };
}

export async function apiUploadProfilePhotoFile(
  file: File,
): Promise<{ filename: string; url: string }> {
  const payload = await uploadMailApiFile("/uploads/profile-photo", file);
  return {
    filename: String(payload.filename ?? ""),
    url: String(payload.url ?? ""),
  };
}

export function resolveStoredAssetUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("LOCAL:")) {
    return localAssetUrl(raw);
  }
  return raw;
}

export function resolveAnnouncementAssetUrl(raw: string | null | undefined): string | null {
  return resolveStoredAssetUrl(raw);
}

export function resolveTrainingVideoEmbedUrl(video: TrainingVideo): string {
  const raw = video.driveRef || video.videoUrl;
  if (video.storageType === "Local" || raw.startsWith("LOCAL:")) {
    return localAssetUrl(raw);
  }
  if (isGoogleDocUrl(raw)) return raw;
  return `https://drive.google.com/file/d/${extractDriveId(raw)}/preview`;
}

export function resolveTrainingVideoOpenUrl(video: TrainingVideo): string {
  const raw = video.driveRef || video.videoUrl;
  if (video.storageType === "Local" || raw.startsWith("LOCAL:")) {
    return localAssetUrl(raw);
  }
  if (isGoogleDocUrl(raw)) return raw;
  return `https://drive.google.com/file/d/${extractDriveId(raw)}/view`;
}

export function resolveTrainingVideoDownloadUrl(video: TrainingVideo): string {
  const raw = video.driveRef || video.videoUrl;
  if (video.storageType === "Local" || raw.startsWith("LOCAL:")) {
    return localAssetUrl(raw);
  }
  if (isGoogleDocUrl(raw)) return raw;
  return `https://drive.google.com/uc?export=download&id=${extractDriveId(raw)}`;
}

export function resolveTrainingDocumentViewUrl(doc: TrainingDocument): string {
  const raw = doc.driveRef || doc.fileUrl;
  if (doc.storageType === "Local" || raw.startsWith("LOCAL:")) {
    return localAssetUrl(raw);
  }
  if (isGoogleDocUrl(raw)) return raw;
  return `https://drive.google.com/file/d/${extractDriveId(raw)}/view`;
}

export function resolveTrainingDocumentDownloadUrl(
  doc: TrainingDocument,
): string {
  const raw = doc.driveRef || doc.fileUrl;
  if (doc.storageType === "Local" || raw.startsWith("LOCAL:")) {
    return localAssetUrl(raw);
  }
  if (isGoogleDocUrl(raw)) return raw;
  return `https://drive.google.com/uc?export=download&id=${extractDriveId(raw)}`;
}

function currentTrainingUser() {
  return getStoredAuthUser();
}

function canUserAccessVideo(video: TrainingVideo, user: User | null) {
  return userMatchesScopedItem(user, video);
}

function canUserAccessDocument(doc: TrainingDocument, user: User | null) {
  return userMatchesScopedItem(user, doc);
}

function eligibleUsersForVideo(video: TrainingVideo) {
  return getPortalActiveUsers().filter((user) => userMatchesScopedItem(user, video));
}

function eligibleUsersForDocument(doc: TrainingDocument) {
  return getPortalActiveUsers().filter((user) => userMatchesScopedItem(user, doc));
}

const SEEDED_TRAINING_VIDEOS: TrainingVideo[] = [
  {
    id: 1,
    title: "Cybersecurity Fundamentals for Bank Staff",
    description:
      "Essential cybersecurity practices including phishing awareness, password management, and safe online banking protocols for all BCB staff.",
    videoUrl: "DRIVE:1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74",
    thumbnailUrl: null,
    duration: 1800,
    category: "IT Security",
    visibleTo: [],
    visibility: "General",
    department: null,
    isMandatory: true,
    allowDownload: false,
    storageType: "Drive",
    driveRef: "DRIVE:1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74",
    localFilename: null,
    uploadedBy: "Emmanuel Asante",
    uploadedAt: BigInt(Date.now() - 604800000),
    viewCount: 42,
    isArchived: false,
  },
  {
    id: 2,
    title: "AML & KYC Compliance Training 2026",
    description:
      "Anti-Money Laundering and Know Your Customer procedures as per Bank of Ghana regulations. Mandatory for all customer-facing staff.",
    videoUrl: "DRIVE:1KhJmNpQrStUvWxYzAbCdEfGhIjKlMnOp5",
    thumbnailUrl: null,
    duration: 2700,
    category: "Compliance",
    visibleTo: [],
    visibility: "General",
    department: null,
    isMandatory: true,
    allowDownload: false,
    storageType: "Drive",
    driveRef: "DRIVE:1KhJmNpQrStUvWxYzAbCdEfGhIjKlMnOp5",
    localFilename: null,
    uploadedBy: "Sarah Mensah",
    uploadedAt: BigInt(Date.now() - 1209600000),
    viewCount: 67,
    isArchived: false,
  },
  {
    id: 3,
    title: "T24 Core Banking System — Loan Modules",
    description:
      "Step-by-step guide to processing farm and personal loans in the T24 Core Banking System. Credit department staff only.",
    videoUrl: "DRIVE:1PqRsTuVwXyZaBcDeFgHiJkLmNoPqRsTu2",
    thumbnailUrl: null,
    duration: 3600,
    category: "Banking Operations",
    visibleTo: [],
    visibility: "Department",
    department: "CREDIT",
    isMandatory: true,
    allowDownload: false,
    storageType: "Drive",
    driveRef: "DRIVE:1PqRsTuVwXyZaBcDeFgHiJkLmNoPqRsTu2",
    localFilename: null,
    uploadedBy: "Emmanuel Asante",
    uploadedAt: BigInt(Date.now() - 2592000000),
    viewCount: 18,
    isArchived: false,
  },
  {
    id: 4,
    title: "Customer Service Excellence — BCB Standards",
    description:
      "Delivering world-class service at every touchpoint: greeting, problem resolution, escalation, and feedback management.",
    videoUrl: "DRIVE:1CuSt0MerServ1ceExceL1ence2026",
    thumbnailUrl: null,
    duration: 2100,
    category: "Customer Service",
    visibleTo: [],
    visibility: "General",
    department: null,
    isMandatory: false,
    allowDownload: true,
    storageType: "Drive",
    driveRef: "DRIVE:1CuSt0MerServ1ceExceL1ence2026",
    localFilename: null,
    uploadedBy: "Sarah Mensah",
    uploadedAt: BigInt(Date.now() - 432000000),
    viewCount: 55,
    isArchived: false,
  },
];

const SEEDED_TRAINING_DOCUMENTS: TrainingDocument[] = [
  {
    id: 1,
    title: "BCB Staff Handbook 2026",
    description:
      "Comprehensive guide to BCB policies, procedures, benefits, and staff conduct expectations.",
    fileUrl: "DRIVE:1VwXyZaBcDeFgHiJkLmNoPqRsTuVwXyZaB",
    fileType: "application/pdf",
    category: "HR",
    visibleTo: [],
    visibility: "General",
    department: null,
    isMandatory: true,
    allowDownload: true,
    storageType: "Drive",
    driveRef: "DRIVE:1VwXyZaBcDeFgHiJkLmNoPqRsTuVwXyZaB",
    localFilename: null,
    uploadedBy: "Emmanuel Asante",
    uploadedAt: BigInt(Date.now() - 2592000000),
    downloadCount: 89,
    isArchived: false,
  },
  {
    id: 2,
    title: "Anti-Money Laundering Policy 2026",
    description:
      "Updated AML policy incorporating Bank of Ghana's latest directives. All staff must acknowledge receipt.",
    fileUrl: "DRIVE:1AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfG",
    fileType: "application/pdf",
    category: "Compliance",
    visibleTo: [],
    visibility: "General",
    department: null,
    isMandatory: true,
    allowDownload: true,
    storageType: "Drive",
    driveRef: "DRIVE:1AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfG",
    localFilename: null,
    uploadedBy: "Sarah Mensah",
    uploadedAt: BigInt(Date.now() - 1209600000),
    downloadCount: 72,
    isArchived: false,
  },
  {
    id: 3,
    title: "Branch Operations Manual — KASOA Branches",
    description:
      "Daily operations checklist, cash handling procedures, and end-of-day reporting for KASOA MAIN and KASOA NEW MARKET.",
    fileUrl: "DRIVE:1HiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmN",
    fileType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    category: "Operations",
    visibleTo: [],
    visibility: "Department",
    department: "BANKING OPERATIONS",
    isMandatory: true,
    allowDownload: true,
    storageType: "Drive",
    driveRef: "DRIVE:1HiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmN",
    localFilename: null,
    uploadedBy: "Sarah Mensah",
    uploadedAt: BigInt(Date.now() - 864000000),
    downloadCount: 23,
    isArchived: false,
  },
  {
    id: 4,
    title: "IT Security Policy — Password & Access Control",
    description:
      "Password requirements, system access protocols, and incident reporting guidelines for all BCB IT systems.",
    fileUrl: "DRIVE:1OpQrStUvWxYzAbCdEfGhIjKlMnOpQrStU",
    fileType: "application/pdf",
    category: "IT Security",
    visibleTo: [],
    visibility: "General",
    department: null,
    isMandatory: true,
    allowDownload: true,
    storageType: "Drive",
    driveRef: "DRIVE:1OpQrStUvWxYzAbCdEfGhIjKlMnOpQrStU",
    localFilename: null,
    uploadedBy: "Emmanuel Asante",
    uploadedAt: BigInt(Date.now() - 172800000),
    downloadCount: 61,
    isArchived: false,
  },
];

const _trainingVideos: TrainingVideo[] = loadContentCache(
  TRAINING_VIDEOS_STORE_KEY,
  SEEDED_TRAINING_VIDEOS,
  deserializeTrainingVideo,
);
const _trainingDocuments: TrainingDocument[] = loadContentCache(
  TRAINING_DOCUMENTS_STORE_KEY,
  SEEDED_TRAINING_DOCUMENTS,
  deserializeTrainingDocument,
);

const _videoProgress: Record<string, VideoProgress> = {};
const _documentOpens: Record<string, bigint> = {};
let _videoIdCounter = Math.max(0, ..._trainingVideos.map((item) => item.id)) + 1;
let _docIdCounter = Math.max(0, ..._trainingDocuments.map((item) => item.id)) + 1;

function videoProgressKey(userId: string, videoId: number) {
  return `${userId}-${videoId}`;
}

function documentOpenKey(userId: string, docId: number) {
  return `${userId}-${docId}`;
}

_videoProgress[videoProgressKey("db-user-2", 1)] = {
  videoId: 1,
  progressPercent: 100,
  isComplete: true,
  lastWatched: BigInt(Date.now() - 43200000),
};
_videoProgress[videoProgressKey("db-user-6", 1)] = {
  videoId: 1,
  progressPercent: 72,
  isComplete: false,
  lastWatched: BigInt(Date.now() - 21600000),
};
_videoProgress[videoProgressKey("db-user-9", 2)] = {
  videoId: 2,
  progressPercent: 100,
  isComplete: true,
  lastWatched: BigInt(Date.now() - 86400000),
};
_videoProgress[videoProgressKey("db-user-7", 4)] = {
  videoId: 4,
  progressPercent: 100,
  isComplete: true,
  lastWatched: BigInt(Date.now() - 86400000),
};
_documentOpens[documentOpenKey("db-user-2", 1)] = BigInt(Date.now() - 43200000);
_documentOpens[documentOpenKey("db-user-8", 1)] = BigInt(
  Date.now() - 172800000,
);
_documentOpens[documentOpenKey("db-user-6", 2)] = BigInt(Date.now() - 86400000);
_documentOpens[documentOpenKey("db-user-3", 4)] = BigInt(Date.now() - 5400000);

export async function apiGetTrainingVideos(): Promise<TrainingVideo[]> {
  await delay(400);
  try {
    const payload = await getMailApiJson("/content/training/videos");
    const sharedItems = Array.isArray(payload.videos)
      ? (payload.videos as Array<Record<string, unknown>>).map(deserializeTrainingVideo)
      : [];
    replaceSharedTrainingVideos(sharedItems);
  } catch {
    if (!ENABLE_SEEDED_FALLBACK) {
      replaceSharedTrainingVideos([]);
    }
  }
  const user = currentTrainingUser();
  return _trainingVideos
    .filter((video) => !video.isArchived)
    .filter((video) => canUserAccessVideo(video, user))
    .sort((a, b) => Number(b.uploadedAt) - Number(a.uploadedAt));
}

export function apiGetCachedTrainingVideos(): TrainingVideo[] {
  const user = currentTrainingUser();
  return _trainingVideos
    .filter((video) => !video.isArchived)
    .filter((video) => canUserAccessVideo(video, user))
    .sort((a, b) => Number(b.uploadedAt) - Number(a.uploadedAt));
}

export async function apiGetTrainingVideo(
  id: number,
): Promise<TrainingVideo | null> {
  await delay(200);
  await apiGetTrainingVideos();
  const user = currentTrainingUser();
  const video =
    _trainingVideos.find((item) => item.id === id && !item.isArchived) ?? null;
  if (!video || !canUserAccessVideo(video, user)) return null;
  return video;
}

export async function apiUploadTrainingVideo(
  req: UploadVideoRequest,
): Promise<ApiResult<TrainingVideo>> {
  await delay(600);
  try {
    const payload = await postMailApiJson("/content/training/videos", {
      title: req.title,
      description: req.description,
      videoUrl: req.videoUrl,
      thumbnailUrl: null,
      duration: 0,
      category:
        req.visibility === "Department"
          ? (req.department ?? "General")
          : "General",
      visibleTo: [],
      visibility: req.visibility,
      department:
        req.visibility === "Department" ? (req.department ?? null) : null,
      branchScope: req.branchScope ?? ["ALL"],
      departmentScope:
        req.departmentScope ??
        (req.visibility === "Department" && req.department
          ? [req.department]
          : ["ALL"]),
      isMandatory: !!req.mandatory,
      allowDownload: !!req.allowDownload,
      storageType: req.storageType,
      driveRef: req.storageType === "Drive" ? req.videoUrl : null,
      localFilename:
        req.storageType === "Local" ? req.videoUrl.replace(/^LOCAL:/, "") : null,
      viewCount: 0,
      isArchived: false,
      sendExternalEmails: !!req.sendExternalEmails,
    });
    const rawVideo = payload.video as Record<string, unknown> | undefined;
    if (!rawVideo) return err("Video could not be uploaded");
    const video = deserializeTrainingVideo(rawVideo);
    _trainingVideos.unshift(video);
    apiRecordActivity("Training video uploaded", `${video.title} was added.`);
    return ok(video);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Video could not be uploaded");
  }
}

export async function apiUpdateTrainingProgress(
  videoId: number,
  progressPercent: number,
): Promise<void> {
  const user = currentTrainingUser();
  if (!user) return;
  try {
    const payload = await postMailApiJson(`/content/training/videos/${videoId}/progress`, {
      progressPercent,
    });
    const raw = payload.progress as Record<string, unknown> | undefined;
    const nextPercent = Number(raw?.progressPercent ?? progressPercent);
    const isComplete = Boolean(raw?.isComplete ?? nextPercent >= 98);
    _videoProgress[videoProgressKey(user.id, videoId)] = {
      videoId,
      progressPercent: nextPercent,
      isComplete,
      lastWatched: contentBigInt(raw?.lastWatched) || BigInt(Date.now()),
    };
    const watchedUserIds = new Set(
      Object.entries(_videoProgress)
        .filter(([, item]) => item.videoId === videoId && item.progressPercent > 0)
        .map(([key]) => key.split("-").slice(0, -1).join("-")),
    );
    const video = _trainingVideos.find((item) => item.id === videoId);
    if (video) video.viewCount = watchedUserIds.size;
    return;
  } catch {
    // Fall back to local state below.
  }
  const key = videoProgressKey(user.id, videoId);
  _videoProgress[key] = {
    videoId,
    progressPercent,
    isComplete: progressPercent >= 98,
    lastWatched: BigInt(Date.now()),
  };
  const watchedCount = Object.values(_videoProgress).filter(
    (item) => item.videoId === videoId && item.progressPercent > 0,
  ).length;
  const video = _trainingVideos.find((item) => item.id === videoId);
  if (video) video.viewCount = watchedCount;
}

export async function apiGetMyVideoProgress(
  videoId: number,
): Promise<VideoProgress | null> {
  await delay(150);
  const user = currentTrainingUser();
  if (!user) return null;
  try {
    const payload = await getMailApiJson(`/content/training/videos/${videoId}/progress`);
    const raw = payload.progress as Record<string, unknown> | null | undefined;
    if (!raw) return null;
    return {
      videoId: Number(raw.videoId ?? videoId),
      progressPercent: Number(raw.progressPercent ?? 0),
      isComplete: !!raw.isComplete,
      lastWatched: contentBigInt(raw.lastWatched),
    };
  } catch {
    // Fall back to local state below.
  }
  return _videoProgress[videoProgressKey(user.id, videoId)] ?? null;
}

export async function apiGetVideoWatchStats(): Promise<VideoWatchStat[]> {
  await delay(300);
  try {
    const payload = await getMailApiJson("/content/training/videos/stats");
    const stats = Array.isArray(payload.stats)
      ? (payload.stats as Array<Record<string, unknown>>).map((item) => ({
          videoId: Number(item.videoId ?? 0),
          title: String(item.title ?? ""),
          totalWatched: Number(item.totalWatched ?? 0),
          completedCount: Number(item.completedCount ?? 0),
        }))
      : [];
    return stats;
  } catch {
    // Fall back to local state below.
  }
  return _trainingVideos
    .filter((video) => !video.isArchived)
    .map((video) => ({
      videoId: video.id,
      title: video.title,
      totalWatched: Object.values(_videoProgress).filter(
        (item) => item.videoId === video.id && item.progressPercent > 0,
      ).length,
      completedCount: Object.values(_videoProgress).filter(
        (item) => item.videoId === video.id && item.isComplete,
      ).length,
    }));
}

export async function apiGetTrainingDocuments(): Promise<TrainingDocument[]> {
  await delay(400);
  try {
    const payload = await getMailApiJson("/content/training/documents");
    const sharedItems = Array.isArray(payload.documents)
      ? (payload.documents as Array<Record<string, unknown>>).map(deserializeTrainingDocument)
      : [];
    replaceSharedTrainingDocuments(sharedItems);
  } catch {
    if (!ENABLE_SEEDED_FALLBACK) {
      replaceSharedTrainingDocuments([]);
    }
  }
  const user = currentTrainingUser();
  return _trainingDocuments
    .filter((doc) => !doc.isArchived)
    .filter((doc) => canUserAccessDocument(doc, user))
    .sort((a, b) => Number(b.uploadedAt) - Number(a.uploadedAt));
}

export function apiGetCachedTrainingDocuments(): TrainingDocument[] {
  const user = currentTrainingUser();
  return _trainingDocuments
    .filter((doc) => !doc.isArchived)
    .filter((doc) => canUserAccessDocument(doc, user))
    .sort((a, b) => Number(b.uploadedAt) - Number(a.uploadedAt));
}

export async function apiGetTrainingDocument(
  id: number,
): Promise<TrainingDocument | null> {
  await delay(200);
  await apiGetTrainingDocuments();
  const user = currentTrainingUser();
  const doc =
    _trainingDocuments.find((item) => item.id === id && !item.isArchived) ??
    null;
  if (!doc || !canUserAccessDocument(doc, user)) return null;
  return doc;
}

export async function apiUploadTrainingDocument(
  req: UploadDocumentRequest,
): Promise<ApiResult<TrainingDocument>> {
  await delay(600);
  try {
    const payload = await postMailApiJson("/content/training/documents", {
      title: req.title,
      description: req.description,
      fileUrl: req.fileUrl,
      fileType: req.fileType,
      category:
        req.visibility === "Department"
          ? (req.department ?? "General")
          : "General",
      visibleTo: [],
      visibility: req.visibility,
      department:
        req.visibility === "Department" ? (req.department ?? null) : null,
      branchScope: req.branchScope ?? ["ALL"],
      departmentScope:
        req.departmentScope ??
        (req.visibility === "Department" && req.department
          ? [req.department]
          : ["ALL"]),
      isMandatory: !!req.mandatory,
      allowDownload: !!req.allowDownload,
      storageType: req.storageType,
      driveRef: req.storageType === "Drive" ? req.fileUrl : null,
      localFilename:
        req.storageType === "Local" ? req.fileUrl.replace(/^LOCAL:/, "") : null,
      downloadCount: 0,
      isArchived: false,
      sendExternalEmails: !!req.sendExternalEmails,
    });
    const rawDocument = payload.document as Record<string, unknown> | undefined;
    if (!rawDocument) return err("Document could not be uploaded");
    const doc = deserializeTrainingDocument(rawDocument);
    _trainingDocuments.unshift(doc);
    apiRecordActivity("Training document uploaded", `${doc.title} was added.`);
    return ok(doc);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Document could not be uploaded");
  }
}

export async function apiMarkDocumentOpened(id: number): Promise<void> {
  const user = currentTrainingUser();
  if (!user) return;
  try {
    const payload = await postMailApiJson(`/content/training/documents/${id}/open`, {});
    const raw = payload.state as Record<string, unknown> | undefined;
    const openedAt =
      contentBigInt(raw?.openedAt) || BigInt(Date.now());
    _documentOpens[documentOpenKey(user.id, id)] = openedAt;
    const openedUserIds = new Set(
      Object.keys(_documentOpens)
        .filter((key) => key.endsWith(`-${id}`)),
    );
    const doc = _trainingDocuments.find((item) => item.id === id);
    if (doc) doc.downloadCount = openedUserIds.size;
    return;
  } catch {
    // Fall back to local state below.
  }
  _documentOpens[documentOpenKey(user.id, id)] = BigInt(Date.now());
  const doc = _trainingDocuments.find((item) => item.id === id);
  if (doc) {
    doc.downloadCount = Object.keys(_documentOpens).filter((key) =>
      key.endsWith(`-${id}`),
    ).length;
  }
}

export async function apiGetDocumentViewStats(): Promise<
  { docId: number; title: string; openedCount: number }[]
> {
  await delay(300);
  try {
    const payload = await getMailApiJson("/content/training/documents/stats");
    const stats = Array.isArray(payload.stats)
      ? (payload.stats as Array<Record<string, unknown>>).map((item) => ({
          docId: Number(item.docId ?? 0),
          title: String(item.title ?? ""),
          openedCount: Number(item.openedCount ?? 0),
        }))
      : [];
    return stats;
  } catch {
    // Fall back to local state below.
  }
  return _trainingDocuments
    .filter((doc) => !doc.isArchived)
    .map((doc) => ({
      docId: doc.id,
      title: doc.title,
      openedCount: Object.keys(_documentOpens).filter((key) =>
        key.endsWith(`-${doc.id}`),
      ).length,
    }));
}

export async function apiGetMyDocumentOpenState(
  docId: number,
): Promise<{ isOpened: boolean; openedAt: bigint | null }> {
  await delay(120);
  const user = currentTrainingUser();
  if (!user) return { isOpened: false, openedAt: null };
  try {
    const payload = await getMailApiJson(`/content/training/documents/${docId}/open-state`);
    const raw = payload.state as Record<string, unknown> | undefined;
    return {
      isOpened: !!raw?.isOpened,
      openedAt:
        raw && raw.openedAt !== null && raw.openedAt !== undefined
          ? contentBigInt(raw.openedAt)
          : null,
    };
  } catch {
    // Fall back to local state below.
  }
  const openedAt = _documentOpens[documentOpenKey(user.id, docId)] ?? null;
  return {
    isOpened: openedAt !== null,
    openedAt,
  };
}

export async function apiGetAdminTrainingOverview(): Promise<AdminTrainingOverview> {
  await delay(500);
  try {
    const payload = await getMailApiJson("/content/training/admin-overview");
    const raw = payload.overview as Record<string, unknown> | undefined;
    if (raw) {
      return {
        totalVideos: Number(raw.totalVideos ?? 0),
        totalDocuments: Number(raw.totalDocuments ?? 0),
        totalStaff: Number(raw.totalStaff ?? 0),
        videoStats: Array.isArray(raw.videoStats)
          ? (raw.videoStats as Array<Record<string, unknown>>).map((item) => ({
              id: Number(item.id ?? 0),
              title: String(item.title ?? ""),
              eligibleCount: Number(item.eligibleCount ?? 0),
              watchedCount: Number(item.watchedCount ?? 0),
              completionPct: Number(item.completionPct ?? 0),
              isMandatory: !!item.isMandatory,
              branchScope: deserializeScopeList(item.branchScope, ["ALL"]),
              departmentScope: deserializeScopeList(item.departmentScope, ["ALL"]),
              incompleteCount: Number(
                item.incompleteCount ??
                  (Array.isArray(item.incompleteUsers)
                    ? item.incompleteUsers.length
                    : 0),
              ),
              incompleteUsers: Array.isArray(item.incompleteUsers)
                ? item.incompleteUsers.map((name) => String(name))
                : [],
            }))
          : [],
        docStats: Array.isArray(raw.docStats)
          ? (raw.docStats as Array<Record<string, unknown>>).map((item) => ({
              id: Number(item.id ?? 0),
              title: String(item.title ?? ""),
              eligibleCount: Number(item.eligibleCount ?? 0),
              openedCount: Number(item.openedCount ?? 0),
              openedPct: Number(item.openedPct ?? 0),
              isMandatory: !!item.isMandatory,
              branchScope: deserializeScopeList(item.branchScope, ["ALL"]),
              departmentScope: deserializeScopeList(item.departmentScope, ["ALL"]),
              incompleteCount: Number(
                item.incompleteCount ??
                  (Array.isArray(item.incompleteUsers)
                    ? item.incompleteUsers.length
                    : 0),
              ),
              incompleteUsers: Array.isArray(item.incompleteUsers)
                ? item.incompleteUsers.map((name) => String(name))
                : [],
            }))
          : [],
      };
    }
  } catch {
    // Fall back to local state below.
  }
  await Promise.all([apiGetTrainingVideos(), apiGetTrainingDocuments()]);
  const totalStaff = getPortalActiveUsers().length;
  return {
    totalVideos: _trainingVideos.filter((v) => !v.isArchived).length,
    totalDocuments: _trainingDocuments.filter((d) => !d.isArchived).length,
    totalStaff,
    videoStats: _trainingVideos
      .filter((v) => !v.isArchived)
      .map((v) => {
        const eligibleUsers = eligibleUsersForVideo(v);
        const completedUserIds = new Set(
          Object.entries(_videoProgress)
            .filter(
              ([, progress]) =>
                progress.videoId === v.id && progress.isComplete,
            )
            .map(([key]) => key.split("-").slice(0, -1).join("-")),
        );
        const watchedUserIds = new Set(
          Object.entries(_videoProgress)
            .filter(
              ([, progress]) =>
                progress.videoId === v.id && progress.progressPercent > 0,
            )
            .map(([key]) => key.split("-").slice(0, -1).join("-")),
        );
        return {
          id: v.id,
          title: v.title,
          eligibleCount: eligibleUsers.length,
          watchedCount: watchedUserIds.size,
          completionPct: eligibleUsers.length
            ? Math.round((completedUserIds.size / eligibleUsers.length) * 100)
            : 0,
          isMandatory: !!v.isMandatory,
          branchScope: v.branchScope ?? ["ALL"],
          departmentScope: v.departmentScope ?? ["ALL"],
          incompleteCount: eligibleUsers.filter(
            (user) => !completedUserIds.has(user.id),
          ).length,
          incompleteUsers: eligibleUsers
            .filter((user) => !completedUserIds.has(user.id))
            .slice(0, 100)
            .map((user) => user.fullname),
        };
      }),
    docStats: _trainingDocuments
      .filter((d) => !d.isArchived)
      .map((d) => {
        const eligibleUsers = eligibleUsersForDocument(d);
        const openedUserIds = new Set(
          Object.keys(_documentOpens)
            .filter((key) => key.endsWith(`-${d.id}`))
            .map((key) => key.split("-").slice(0, -1).join("-")),
        );
        return {
          id: d.id,
          title: d.title,
          eligibleCount: eligibleUsers.length,
          openedCount: openedUserIds.size,
          openedPct: eligibleUsers.length
            ? Math.round((openedUserIds.size / eligibleUsers.length) * 100)
            : 0,
          isMandatory: !!d.isMandatory,
          branchScope: d.branchScope ?? ["ALL"],
          departmentScope: d.departmentScope ?? ["ALL"],
          incompleteCount: eligibleUsers.filter(
            (user) => !openedUserIds.has(user.id),
          ).length,
          incompleteUsers: eligibleUsers
            .filter((user) => !openedUserIds.has(user.id))
            .slice(0, 100)
            .map((user) => user.fullname),
        };
      }),
  };
}

export async function apiArchiveTrainingVideo(
  id: number,
): Promise<ApiResult<null>> {
  await delay(300);
  const video = _trainingVideos.find((v) => v.id === id);
  if (!video) return err("Video not found");
  if (id >= 1000) {
    try {
      await postMailApi(`/content/training/videos/${id}/archive`, {});
      video.isArchived = true;
      return ok(null);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Video not found");
    }
  }
  video.isArchived = true;
  return ok(null);
}

export async function apiDeleteTrainingVideo(
  id: number,
): Promise<ApiResult<null>> {
  await delay(300);
  const idx = _trainingVideos.findIndex((v) => v.id === id);
  if (idx < 0) return err("Video not found");
  if (id >= 1000) {
    try {
      await postMailApi(`/content/training/videos/${id}/delete`, {});
    } catch (error) {
      return err(error instanceof Error ? error.message : "Video not found");
    }
  }
  _trainingVideos.splice(idx, 1);
  return ok(null);
}

export async function apiArchiveTrainingDocument(
  id: number,
): Promise<ApiResult<null>> {
  await delay(300);
  const doc = _trainingDocuments.find((item) => item.id === id);
  if (!doc) return err("Document not found");
  if (id >= 1000) {
    try {
      await postMailApi(`/content/training/documents/${id}/archive`, {});
      doc.isArchived = true;
      return ok(null);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Document not found");
    }
  }
  doc.isArchived = true;
  return ok(null);
}

export async function apiDeleteTrainingDocument(
  id: number,
): Promise<ApiResult<null>> {
  await delay(300);
  const idx = _trainingDocuments.findIndex((item) => item.id === id);
  if (idx < 0) return err("Document not found");
  if (id >= 1000) {
    try {
      await postMailApi(`/content/training/documents/${id}/delete`, {});
    } catch (error) {
      return err(error instanceof Error ? error.message : "Document not found");
    }
  }
  _trainingDocuments.splice(idx, 1);
  return ok(null);
}

export async function apiSendVideoTrainingReminder(
  videoId: number,
): Promise<ApiResult<null>> {
  await delay(400);
  try {
    await postMailApi(`/content/training/videos/${videoId}/remind`, {});
    return ok(null);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Reminder could not be sent");
  }
}

export async function apiSendDocumentTrainingReminder(
  documentId: number,
): Promise<ApiResult<null>> {
  await delay(400);
  try {
    await postMailApi(`/content/training/documents/${documentId}/remind`, {});
    return ok(null);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Reminder could not be sent");
  }
}

// ── IT Support ────────────────────────────────────────────────────────────────

export interface SubmitIncidentRequest {
  agency: string;
  issueCategory: string;
  description: string;
  reporterName: string;
  contact: string;
}

export interface SubmitAmendmentRequest {
  fullname: string;
  phone: string;
  t24Username: string;
  agency: string;
  requestType: string;
  newRole?: string;
  deptChange?: string;
  transferLocation?: string;
  additionalDetails?: string;
}

const _incidents: IncidentReport[] = [];

const _amendments: ProfileAmendment[] = []; /*
  {
    id: 1,
    requesterId: "mock-user-3",
    requesterName: "Abena Ofori",
    fullname: "Abena Ofori",
    phone: "0557234789",
    t24Username: "B01.AOFORI",
    agency: "KASOA MAIN",
    requestType: "DEPARTMENTAL CHANGE",
    deptChange: "BANKING OPERATIONS -> E-BANKING",
    field: "Department Change",
    currentValue: "BANKING OPERATIONS",
    requestedValue: "E-BANKING",
    reason: "Transfer approved — KASOA MAIN branch",
    status: "pending",
    reviewedBy: null,
    reviewNote: null,
    createdAt: BigInt(Date.now() - 86400000),
    updatedAt: BigInt(Date.now() - 86400000),
  },
  {
    id: 2,
    requesterId: "mock-user-2",
    requesterName: "Emmanuel Asante",
    fullname: "Emmanuel Asante",
    phone: "0201987654",
    t24Username: "HO1.EASANTE",
    agency: "HEAD OFFICE",
    requestType: "ROLE CHANGE",
    newRole: "Senior HR Officer",
    field: "T24 Amendment",
    currentValue: "HR Officer",
    requestedValue: "Senior HR Officer",
    reason: "Promotion effective April 2026",
    status: "resolved",
    reviewedBy: "mock-user-1",
    reviewNote: "Resolved by IT Admin.",
    createdAt: BigInt(Date.now() - 259200000),
    updatedAt: BigInt(Date.now() - 172800000),
  },
*/

let _incidentIdCounter = 1;
let _amendmentIdCounter = 1;

export async function apiSubmitIncidentReport(
  req: SubmitIncidentRequest,
  reporterId: string,
): Promise<ApiResult<IncidentReport>> {
  await delay(500);
  const report: IncidentReport = {
    id: _incidentIdCounter++,
    reporterId,
    reporterName: req.reporterName,
    agency: req.agency,
    contact: req.contact,
    issueCategory: req.issueCategory,
    subject: req.issueCategory,
    description: req.description,
    priority: "medium",
    status: "open",
    assignedTo: null,
    resolution: null,
    createdAt: BigInt(Date.now()),
    updatedAt: BigInt(Date.now()),
  };
  _incidents.unshift(report);
  return ok(report);
}

export async function apiSubmitProfileAmendment(
  req: SubmitAmendmentRequest,
  requesterId: string,
  requesterName: string,
): Promise<ApiResult<ProfileAmendment>> {
  await delay(500);
  const amendment: ProfileAmendment = {
    id: _amendmentIdCounter++,
    requesterId,
    requesterName,
    fullname: req.fullname,
    phone: req.phone,
    t24Username: req.t24Username,
    agency: req.agency,
    requestType: req.requestType,
    newRole: req.newRole,
    deptChange: req.deptChange,
    transferLocation: req.transferLocation,
    field: req.requestType,
    currentValue: "",
    requestedValue: req.additionalDetails ?? "",
    reason: req.additionalDetails ?? req.requestType,
    status: "pending",
    reviewedBy: null,
    reviewNote: null,
    createdAt: BigInt(Date.now()),
    updatedAt: BigInt(Date.now()),
  };
  _amendments.unshift(amendment);
  return ok(amendment);
}

export async function apiGetIncidentReports(): Promise<IncidentReport[]> {
  await delay(400);
  return [..._incidents].sort(
    (a, b) => Number(b.createdAt) - Number(a.createdAt),
  );
}

export async function apiGetMyIncidents(
  userId: string,
): Promise<IncidentReport[]> {
  await delay(300);
  return _incidents
    .filter((i) => i.reporterId === userId)
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .slice(0, 5);
}

export async function apiGetProfileAmendments(): Promise<ProfileAmendment[]> {
  await delay(400);
  return [..._amendments].sort(
    (a, b) => Number(b.createdAt) - Number(a.createdAt),
  );
}

export async function apiGetMyAmendments(
  userId: string,
): Promise<ProfileAmendment[]> {
  await delay(300);
  return _amendments
    .filter((a) => a.requesterId === userId)
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .slice(0, 5);
}

export async function apiResolveIncidentReport(
  id: number,
  resolution: string,
): Promise<ApiResult<null>> {
  await delay(300);
  const incident = _incidents.find((i) => i.id === id);
  if (!incident) return err("Incident not found");
  incident.status = "resolved";
  incident.resolution = resolution;
  incident.updatedAt = BigInt(Date.now());
  return ok(null);
}

export async function apiResolveProfileAmendment(
  id: number,
  _approved: boolean,
  note: string,
  reviewerId: string,
): Promise<ApiResult<null>> {
  await delay(300);
  const amendment = _amendments.find((a) => a.id === id);
  if (!amendment) return err("Amendment not found");
  amendment.status = "resolved";
  amendment.reviewedBy = reviewerId;
  amendment.reviewNote = note;
  amendment.updatedAt = BigInt(Date.now());
  return ok(null);
}

export async function apiDeleteResolvedIncidents(
  ids: number[],
): Promise<ApiResult<null>> {
  await delay(300);
  for (const id of ids) {
    const idx = _incidents.findIndex((i) => i.id === id);
    if (idx >= 0) _incidents.splice(idx, 1);
  }
  return ok(null);
}

export async function apiDeleteResolvedAmendments(
  ids: number[],
): Promise<ApiResult<null>> {
  await delay(300);
  for (const id of ids) {
    const idx = _amendments.findIndex((a) => a.id === id);
    if (idx >= 0) _amendments.splice(idx, 1);
  }
  return ok(null);
}

export async function apiClearAllIncidents(): Promise<ApiResult<null>> {
  await delay(300);
  _incidents.splice(0, _incidents.length);
  return ok(null);
}

export async function apiClearAllAmendments(): Promise<ApiResult<null>> {
  await delay(300);
  _amendments.splice(0, _amendments.length);
  return ok(null);
}

// AGM Import / Shareholders
const _agmShareholders: AgmShareholderRecord[] = loadContentCache(
  AGM_SHAREHOLDERS_STORE_KEY,
  AGM_SHAREHOLDERS,
  deserializeAgmShareholder,
);
const _agmImportBatches: AgmImportBatchRecord[] = loadContentCache(
  AGM_IMPORT_BATCHES_STORE_KEY,
  [],
  deserializeAgmImportBatch,
);
const _agmSettings: AgmSettingsRecord = (() => {
  if (typeof window === "undefined") {
    return {
      agmName: AGM_SUMMARY.agmName,
      venue: AGM_SUMMARY.venue,
      agmDate: AGM_SUMMARY.agmDate,
      quorumRequiredPct: AGM_SUMMARY.quorumRequiredPct,
    };
  }
  try {
    const raw = window.localStorage.getItem(AGM_SETTINGS_STORE_KEY);
    if (!raw) {
      return {
        agmName: AGM_SUMMARY.agmName,
        venue: AGM_SUMMARY.venue,
        agmDate: AGM_SUMMARY.agmDate,
        quorumRequiredPct: AGM_SUMMARY.quorumRequiredPct,
      };
    }
    return deserializeAgmSettings(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return {
      agmName: AGM_SUMMARY.agmName,
      venue: AGM_SUMMARY.venue,
      agmDate: AGM_SUMMARY.agmDate,
      quorumRequiredPct: AGM_SUMMARY.quorumRequiredPct,
    };
  }
})();
const _agmOperatorActivity: AgmOperatorActivityRecord[] = loadContentCache(
  AGM_OPERATOR_ACTIVITY_STORE_KEY,
  [],
  deserializeAgmOperatorActivity,
);

function persistAgmSettings() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AGM_SETTINGS_STORE_KEY, JSON.stringify(_agmSettings));
  } catch {
    // ignore storage failures
  }
}

function recordAgmOperatorActivity(
  operatorName: string,
  action: string,
  target: string,
  branch: string,
) {
  const entry: AgmOperatorActivityRecord = {
    id: `agm-activity-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    operatorName,
    action,
    target,
    branch,
    timestamp: new Date().toISOString(),
  };
  _agmOperatorActivity.unshift(entry);
  persistContentCache(AGM_OPERATOR_ACTIVITY_STORE_KEY, _agmOperatorActivity);
}

function mapAgmStatusToRegistrationType(status: unknown): AgmRegistrationType {
  switch (agmVariantKey(status)) {
    case "RegisteredInPerson":
      return "In Person";
    case "RegisteredProxy":
      return "Proxy";
    default:
      return "Not Registered";
  }
}

function mapAgmImportStatus(status: unknown): AgmImportBatchRecord["status"] {
  return agmVariantKey(status) === "Complete"
    ? "Completed"
    : "Completed With Issues";
}

function syncAgmShareholderCache(records: AgmShareholderRecord[]) {
  _agmShareholders.splice(0, _agmShareholders.length, ...records);
  persistContentCache(AGM_SHAREHOLDERS_STORE_KEY, _agmShareholders);
}

function mapAgmShareholdersFromState(
  shareholders: Array<Record<string, unknown>>,
  registrations: Array<Record<string, unknown>>,
  checkIns: Array<Record<string, unknown>>,
): AgmShareholderRecord[] {
  const registrationByShareholder = new Map(
    registrations.map((item) => [String(item.shareholderId ?? ""), item]),
  );
  const checkInByShareholder = new Map(
    checkIns.map((item) => [String(item.shareholderId ?? ""), item]),
  );

  return shareholders
    .map((item) => {
      const id = String(item.id ?? "");
      const registration = registrationByShareholder.get(id);
      const checkIn = checkInByShareholder.get(id);
      const branch = extractAgmBranch(
        Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
      );
      return {
        id,
        fullName: String(item.fullName ?? ""),
        shareholderNumber: String(item.shareholderNumber ?? "").trim().toUpperCase(),
        branch,
        shareholding:
          typeof item.shareholding === "bigint"
            ? Number(item.shareholding)
            : Number(item.shareholding ?? 0),
        phone:
          agmOptionalText(registration?.proxyContact) ??
          agmOptionalText(item.phone) ??
          "",
        ghanaCardId: String(item.idNumber ?? "").trim().toUpperCase(),
        registrationType:
          agmVariantKey(item.status) === "CheckedIn"
            ? agmVariantKey(registration?.registrationType) === "Proxy"
              ? "Proxy"
              : "In Person"
            : mapAgmStatusToRegistrationType(item.status),
        verificationCode: String(registration?.verificationCode ?? ""),
        registeredBy: String(registration?.registeredBy ?? ""),
        registeredAt: agmTimestampToIso(registration?.registeredAt),
        checkedInAt: agmTimestampToIso(checkIn?.checkedInAt),
        proxyName: agmOptionalText(registration?.proxyName),
        proxyPhone: agmOptionalText(registration?.proxyContact),
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

async function fetchLiveAgmShareholders(): Promise<AgmShareholderRecord[] | null> {
  const actor = await getAgmActor();
  if (!actor) return null;
  try {
    const activeYear = getStoredAgmYear();
    const [shareholders, registrations, checkIns] = await Promise.all([
      actor.agmGetAllShareholders(activeYear),
      actor.agmGetAllRegistrations(activeYear),
      actor.agmGetAllCheckIns(activeYear),
    ]);
    const mapped = mapAgmShareholdersFromState(
      shareholders as Array<Record<string, unknown>>,
      registrations as Array<Record<string, unknown>>,
      checkIns as Array<Record<string, unknown>>,
    );
    syncAgmShareholderCache(mapped);
    return mapped;
  } catch {
    return null;
  }
}

async function fetchLiveAgmSettings(): Promise<AgmSettingsRecord | null> {
  const actor = await getAgmActor();
  if (!actor) return null;
  try {
    const settings = await actor.agmGetSettings(getStoredAgmYear());
    const mapped: AgmSettingsRecord = {
      agmName: String(settings.agmName ?? AGM_SUMMARY.agmName),
      venue: String(settings.venue ?? AGM_SUMMARY.venue),
      agmDate: String(settings.agmDate ?? AGM_SUMMARY.agmDate),
      quorumRequiredPct:
        typeof settings.quorumThreshold === "bigint"
          ? Number(settings.quorumThreshold)
          : Number(settings.quorumThreshold ?? AGM_SUMMARY.quorumRequiredPct),
    };
    _agmSettings.agmName = mapped.agmName;
    _agmSettings.venue = mapped.venue;
    _agmSettings.agmDate = mapped.agmDate;
    _agmSettings.quorumRequiredPct = mapped.quorumRequiredPct;
    persistAgmSettings();
    return mapped;
  } catch {
    return null;
  }
}

async function fetchLiveAgmImportBatches(): Promise<AgmImportBatchRecord[] | null> {
  const actor = await getAgmActor();
  if (!actor) return null;
  try {
    const batches = await actor.agmGetImportBatches(getStoredAgmYear());
    const metaById = new Map(_agmImportBatches.map((item) => [item.id, item]));
    const mapped = (batches as Array<Record<string, unknown>>)
      .map((item) => {
        const cached = metaById.get(String(item.id ?? ""));
        return {
          id: String(item.id ?? ""),
          filename: String(item.filename ?? ""),
          branch: cached?.branch ?? "Head Office",
          importedAt: agmTimestampToIso(item.uploadedAt) ?? new Date().toISOString(),
          importedRows:
            typeof item.importedRows === "bigint"
              ? Number(item.importedRows)
              : Number(item.importedRows ?? 0),
          duplicateRows:
            typeof item.duplicatesSkipped === "bigint"
              ? Number(item.duplicatesSkipped)
              : Number(item.duplicatesSkipped ?? 0),
          errorRows: cached?.errorRows ?? 0,
          status: mapAgmImportStatus(item.status),
          operatorName: String(item.uploadedBy ?? cached?.operatorName ?? "AGM Operator"),
        } satisfies AgmImportBatchRecord;
      })
      .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    _agmImportBatches.splice(0, _agmImportBatches.length, ...mapped);
    persistContentCache(AGM_IMPORT_BATCHES_STORE_KEY, _agmImportBatches);
    return mapped;
  } catch {
    return null;
  }
}

export async function apiGetAgmShareholders(): Promise<AgmShareholderRecord[]> {
  const live = await fetchLiveAgmShareholders();
  if (live) return live;
  await delay(200);
  return [..._agmShareholders].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function apiGetCachedAgmShareholders(): AgmShareholderRecord[] {
  return [..._agmShareholders].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function apiGetAgmImportBatches(): Promise<AgmImportBatchRecord[]> {
  const live = await fetchLiveAgmImportBatches();
  if (live) return live;
  await delay(200);
  return [..._agmImportBatches].sort((a, b) =>
    b.importedAt.localeCompare(a.importedAt),
  );
}

export interface AgmImportBatchInput {
  filename: string;
  branch: string;
  rows: MappedRow[];
  duplicateRows: number;
  errorRows: number;
  operatorName: string;
}

export interface AgmRegistrationInput {
  shareholderId: string;
  mode: "in-person" | "proxy";
  phone: string;
  ghanaCardId: string;
  verificationCode: string;
  chitNumber: string;
  operatorName: string;
  proxyName?: string;
  proxyPhone?: string;
}

export interface AgmCheckInInput {
  shareholderId: string;
  operatorName: string;
  method?: "manual" | "quick" | "qr";
}

export interface AgmLiveSummary {
  agmName: string;
  venue: string;
  agmDate: string;
  quorumRequiredPct: number;
  totalShareholders: number;
  registered: number;
  inPerson: number;
  proxy: number;
  checkedIn: number;
}

export interface AgmOverview {
  summary: AgmLiveSummary;
  branchTurnout: AgmBranchTurnout[];
  recentRegistrations: AgmRecentRegistration[];
  boardHighlights: AgmBoardHighlight[];
  attendanceRate: number;
  registrationRate: number;
  quorumReached: boolean;
}

export interface AgmRegistrationCorrectionInput {
  shareholderId: string;
  mode: "in-person" | "proxy";
  phone: string;
  ghanaCardId: string;
  verificationCode: string;
  operatorName: string;
  proxyName?: string;
  proxyPhone?: string;
}

function formatRelativeMinutes(timestamp: string): string {
  const deltaMs = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const minutes = Math.max(1, Math.round(deltaMs / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function computeAgmOverview(): AgmOverview {
  const totalShareholders = _agmShareholders.length;
  const registeredRecords = _agmShareholders.filter(
    (record) => record.registrationType !== "Not Registered",
  );
  const checkedInRecords = _agmShareholders.filter((record) => Boolean(record.checkedInAt));
  const inPersonCount = _agmShareholders.filter(
    (record) => record.registrationType === "In Person",
  ).length;
  const proxyCount = _agmShareholders.filter(
    (record) => record.registrationType === "Proxy",
  ).length;
  const registered = registeredRecords.length;
  const checkedIn = checkedInRecords.length;
  const attendanceRate =
    totalShareholders > 0 ? (checkedIn / totalShareholders) * 100 : 0;
  const registrationRate =
    totalShareholders > 0 ? (registered / totalShareholders) * 100 : 0;
  const quorumReached = attendanceRate >= _agmSettings.quorumRequiredPct;

  const branchTurnout: AgmBranchTurnout[] = AGM_BRANCH_OPTIONS.map((branch) => {
    const branchRecords = _agmShareholders.filter((record) => record.branch === branch);
    return {
      branch,
      registered: branchRecords.filter(
        (record) => record.registrationType !== "Not Registered",
      ).length,
      checkedIn: branchRecords.filter((record) => Boolean(record.checkedInAt)).length,
    };
  });

  const recentRegistrations: AgmRecentRegistration[] = [...registeredRecords]
    .filter((record) => record.registeredAt)
    .sort(
      (a, b) =>
        new Date(b.registeredAt ?? 0).getTime() -
        new Date(a.registeredAt ?? 0).getTime(),
    )
    .slice(0, 5)
    .map((record) => ({
      name: record.fullName,
      type: record.registrationType === "Proxy" ? "Proxy" : "In Person",
      branch: record.branch,
      time: formatRelativeMinutes(record.registeredAt ?? new Date().toISOString()),
    }));

  const topBranch =
    [...branchTurnout].sort((a, b) => b.registered - a.registered)[0]?.branch ??
    "No data";

  const boardHighlights: AgmBoardHighlight[] = [
    { label: "Attendance rate", value: `${attendanceRate.toFixed(1)}%` },
    { label: "Quorum status", value: quorumReached ? "Reached" : "Pending" },
    {
      label: "Proxy participation",
      value: registered > 0 ? `${((proxyCount / registered) * 100).toFixed(1)}%` : "0.0%",
    },
    { label: "Top branch turnout", value: topBranch },
  ];

  return {
    summary: {
      agmName: _agmSettings.agmName,
      venue: _agmSettings.venue,
      agmDate: _agmSettings.agmDate,
      quorumRequiredPct: _agmSettings.quorumRequiredPct,
      totalShareholders,
      registered,
      inPerson: inPersonCount,
      proxy: proxyCount,
      checkedIn,
    },
    branchTurnout,
    recentRegistrations,
    boardHighlights,
    attendanceRate,
    registrationRate,
    quorumReached,
  };
}

export async function apiImportAgmShareholderBatch(
  input: AgmImportBatchInput,
): Promise<AgmImportBatchRecord> {
  const actor = await getAgmActor();
  const token = getStoredAgmSessionToken();
  if (actor && token) {
    const activeYear = getStoredAgmYear();
    const batch = await actor.agmCreateImportBatch(
      activeYear,
      input.filename,
      token,
      BigInt(input.rows.length),
    );
    const bulkResult = await actor.agmBulkCreateShareholders(
      activeYear,
      input.rows.map((row) => ({
        shareholderNumber: row.shareholderNumber.trim().toUpperCase(),
        fullName: row.fullName.trim(),
        idNumber: row.idNumber.trim().toUpperCase(),
        email: row.email.trim() ? [row.email.trim()] : [],
        phone: row.phone.trim() ? [row.phone.trim()] : [],
        shareholding: BigInt(Math.max(0, Math.round(row.shareholding))),
        tags: [buildAgmBranchTag(input.branch)],
      })),
      token,
    );

    const duplicateRows =
      Number(bulkResult.duplicates ?? 0n) + input.duplicateRows;
    const statusVariant = input.errorRows > 0 ? { Failed: null } : { Complete: null };
    const updatedBatch = unwrapAgmResult<Record<string, unknown>>(
      await actor.agmUpdateImportBatchStatus(
        activeYear,
        String(batch.id ?? ""),
        statusVariant,
        BigInt(Number(bulkResult.created ?? 0n)),
        BigInt(Number(bulkResult.duplicates ?? 0n)),
      ),
    );

    const mapped: AgmImportBatchRecord = {
      id: String(updatedBatch.id ?? batch.id ?? ""),
      filename: String(updatedBatch.filename ?? input.filename),
      branch: input.branch,
      importedAt:
        agmTimestampToIso(updatedBatch.uploadedAt ?? batch.uploadedAt) ??
        new Date().toISOString(),
      importedRows:
        typeof updatedBatch.importedRows === "bigint"
          ? Number(updatedBatch.importedRows)
          : Number(updatedBatch.importedRows ?? bulkResult.created ?? 0),
      duplicateRows,
      errorRows: input.errorRows,
      status:
        duplicateRows > 0 || input.errorRows > 0
          ? "Completed With Issues"
          : "Completed",
      operatorName: String(updatedBatch.uploadedBy ?? input.operatorName),
    };

    _agmImportBatches.unshift(mapped);
    persistContentCache(AGM_IMPORT_BATCHES_STORE_KEY, _agmImportBatches);
    await fetchLiveAgmShareholders();
    dispatchAgmUpdated();
    apiRecordActivity(
      "AGM Import Completed",
      `${mapped.importedRows} shareholder records imported from ${input.filename} for ${input.branch}.`,
    );
    return mapped;
  }

  await delay(350);
  const seenNumbers = new Set(
    _agmShareholders.map((record) => record.shareholderNumber.toUpperCase()),
  );
  const importedAt = new Date().toISOString();
  let runtimeDuplicates = 0;
  const nextRecords: AgmShareholderRecord[] = [];

  for (const row of input.rows) {
    const shareholderNumber = row.shareholderNumber.trim().toUpperCase();
    if (!shareholderNumber || seenNumbers.has(shareholderNumber)) {
      runtimeDuplicates += 1;
      continue;
    }
    seenNumbers.add(shareholderNumber);
    nextRecords.push({
      id: `agm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      fullName: row.fullName.trim(),
      shareholderNumber,
      branch: input.branch,
      shareholding: Math.max(0, Math.round(row.shareholding)),
      phone: row.phone.trim(),
      ghanaCardId: row.idNumber.trim().toUpperCase(),
      registrationType: "Not Registered",
      verificationCode: "",
      registeredBy: "",
      registeredAt: null,
      checkedInAt: null,
    });
  }

  _agmShareholders.push(...nextRecords);
  persistContentCache(AGM_SHAREHOLDERS_STORE_KEY, _agmShareholders);

  const batch: AgmImportBatchRecord = {
    id: `agm-batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    filename: input.filename,
    branch: input.branch,
    importedAt,
    importedRows: nextRecords.length,
    duplicateRows: input.duplicateRows + runtimeDuplicates,
    errorRows: input.errorRows,
    status:
      input.duplicateRows + runtimeDuplicates > 0 || input.errorRows > 0
        ? "Completed With Issues"
        : "Completed",
    operatorName: input.operatorName,
  };
  _agmImportBatches.unshift(batch);
  persistContentCache(AGM_IMPORT_BATCHES_STORE_KEY, _agmImportBatches);
  dispatchAgmUpdated();

  apiRecordActivity(
    "AGM Import Completed",
    `${batch.importedRows} shareholder records imported from ${input.filename} for ${input.branch}.`,
  );
  await apiLogAction(
    input.operatorName,
    "AGM_IMPORT_BATCH",
    `${input.filename} (${input.branch})`,
    "127.0.0.1",
  );

  return batch;
}

export async function apiGetAgmOverview(): Promise<AgmOverview> {
  await Promise.all([fetchLiveAgmSettings(), fetchLiveAgmShareholders()]);
  await delay(200);
  return computeAgmOverview();
}

export async function apiGetAgmSettings(): Promise<AgmSettingsRecord> {
  const live = await fetchLiveAgmSettings();
  if (live) return live;
  await delay(120);
  return { ..._agmSettings };
}

export async function apiUpdateAgmSettings(
  input: AgmSettingsRecord,
  operatorName: string,
): Promise<AgmSettingsRecord> {
  const actor = await getAgmActor();
  const token = getStoredAgmSessionToken();
  if (actor && token) {
    const updated = unwrapAgmResult<Record<string, unknown>>(
      await actor.agmUpdateSettings(getStoredAgmYear(), token, {
        agmName: input.agmName.trim() || AGM_SUMMARY.agmName,
        venue: input.venue.trim() || AGM_SUMMARY.venue,
        agmDate: input.agmDate.trim() || AGM_SUMMARY.agmDate,
        quorumThreshold: BigInt(
          Math.max(
            1,
            Math.min(100, Math.round(input.quorumRequiredPct || AGM_SUMMARY.quorumRequiredPct)),
          ),
        ),
        sessionTimeoutMinutes: 30n,
      }),
    );
    _agmSettings.agmName = String(updated.agmName ?? AGM_SUMMARY.agmName);
    _agmSettings.venue = String(updated.venue ?? AGM_SUMMARY.venue);
    _agmSettings.agmDate = String(updated.agmDate ?? AGM_SUMMARY.agmDate);
    _agmSettings.quorumRequiredPct =
      typeof updated.quorumThreshold === "bigint"
        ? Number(updated.quorumThreshold)
        : Number(updated.quorumThreshold ?? AGM_SUMMARY.quorumRequiredPct);
    persistAgmSettings();
    recordAgmOperatorActivity(
      operatorName,
      "Updated AGM settings",
      _agmSettings.agmName,
      "Head Office",
    );
    dispatchAgmUpdated();
    return { ..._agmSettings };
  }

  await delay(180);
  _agmSettings.agmName = input.agmName.trim() || AGM_SUMMARY.agmName;
  _agmSettings.venue = input.venue.trim() || AGM_SUMMARY.venue;
  _agmSettings.agmDate = input.agmDate.trim() || AGM_SUMMARY.agmDate;
  _agmSettings.quorumRequiredPct = Math.max(
    1,
    Math.min(100, Math.round(input.quorumRequiredPct || AGM_SUMMARY.quorumRequiredPct)),
  );
  persistAgmSettings();
  recordAgmOperatorActivity(operatorName, "Updated AGM settings", _agmSettings.agmName, "Head Office");
  apiRecordActivity(
    "AGM Settings Updated",
    `${operatorName} updated AGM settings for ${_agmSettings.agmName}.`,
  );
  dispatchAgmUpdated();
  return { ..._agmSettings };
}

export async function apiGetAgmOperatorActivity(): Promise<AgmOperatorActivityRecord[]> {
  const actor = await getAgmActor();
  if (actor) {
    try {
      const entries = await actor.agmGetAuditLog(getStoredAgmYear(), [], [], 20n);
      const mapped = (entries as Array<Record<string, unknown>>)
        .map((entry) => ({
          id: String(entry.id ?? ""),
          operatorName: String(entry.performedBy ?? "AGM Operator"),
          action: String(entry.action ?? "AGM Action"),
          target: String(entry.entityId ?? entry.entityType ?? "AGM Workspace"),
          branch: "Head Office",
          timestamp: agmTimestampToIso(entry.performedAt) ?? new Date().toISOString(),
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      _agmOperatorActivity.splice(0, _agmOperatorActivity.length, ...mapped);
      persistContentCache(AGM_OPERATOR_ACTIVITY_STORE_KEY, _agmOperatorActivity);
      return mapped;
    } catch {
      // fallback below
    }
  }
  await delay(120);
  return [..._agmOperatorActivity].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function apiResetAgmVerificationCode(
  shareholderId: string,
  operatorName: string,
): Promise<AgmShareholderRecord> {
  const actor = await getAgmActor();
  const token = getStoredAgmSessionToken();
  if (actor && token) {
    const activeYear = getStoredAgmYear();
    const registration = await actor.agmGetRegistrationByShareholder(activeYear, shareholderId);
    const registrationRecord = Array.isArray(registration)
      ? (registration[0] as Record<string, unknown> | undefined)
      : (registration as Record<string, unknown> | null);
    if (!registrationRecord?.id) {
      throw new Error("No live AGM registration was found for this shareholder.");
    }
    const nextCode = `AGM-${Math.floor(1000 + Math.random() * 9000)}`;
    unwrapAgmResult(
      await actor.agmUpdateRegistration(
        activeYear,
        String(registrationRecord.id),
        {
          notes: [],
          proxyData: [],
          verificationCode: [nextCode],
        },
        token,
      ),
    );
    const records = await fetchLiveAgmShareholders();
    const updated = records?.find((item) => item.id === shareholderId);
    if (!updated) {
      throw new Error("The verification code was reset but the live record could not be refreshed.");
    }
    dispatchAgmUpdated();
    return updated;
  }

  await delay(150);
  const record = _agmShareholders.find((item) => item.id === shareholderId);
  if (!record) {
    throw new Error("The selected AGM shareholder could not be found.");
  }
  const resetCode = `AGM-${Math.floor(1000 + Math.random() * 9000)}`;
  record.verificationCode = resetCode;
  persistContentCache(AGM_SHAREHOLDERS_STORE_KEY, _agmShareholders);
  recordAgmOperatorActivity(operatorName, "Reset verification code", record.fullName, record.branch);
  apiRecordActivity(
    "AGM Verification Reset",
    `${operatorName} reset the AGM verification code for ${record.fullName}.`,
  );
  dispatchAgmUpdated();
  return { ...record };
}

export async function apiReopenAgmRegistration(
  shareholderId: string,
  operatorName: string,
): Promise<AgmShareholderRecord> {
  const actor = await getAgmActor();
  const token = getStoredAgmSessionToken();
  if (actor && token) {
    const activeYear = getStoredAgmYear();
    const registration = await actor.agmGetRegistrationByShareholder(activeYear, shareholderId);
    const registrationRecord = Array.isArray(registration)
      ? (registration[0] as Record<string, unknown> | undefined)
      : (registration as Record<string, unknown> | null);
    if (!registrationRecord?.id) {
      throw new Error("No live AGM registration was found for this shareholder.");
    }
    const shareholderRecords = await fetchLiveAgmShareholders();
    const current = shareholderRecords?.find((item) => item.id === shareholderId);
    if (current?.checkedInAt) {
      await actor.agmUndoCheckIn(activeYear, shareholderId, token);
    }
    unwrapAgmResult(
      await actor.agmCancelRegistration(
        activeYear,
        String(registrationRecord.id),
        token,
        "Reopened by AGM admin",
      ),
    );
    const records = await fetchLiveAgmShareholders();
    const updated = records?.find((item) => item.id === shareholderId);
    if (!updated) {
      throw new Error("The AGM registration was reopened but the live record could not be refreshed.");
    }
    dispatchAgmUpdated();
    return updated;
  }

  await delay(180);
  const record = _agmShareholders.find((item) => item.id === shareholderId);
  if (!record) {
    throw new Error("The selected AGM shareholder could not be found.");
  }
  record.registrationType = "Not Registered";
  record.verificationCode = "";
  record.registeredBy = "";
  record.registeredAt = null;
  record.checkedInAt = null;
  record.proxyName = undefined;
  record.proxyPhone = undefined;
  persistContentCache(AGM_SHAREHOLDERS_STORE_KEY, _agmShareholders);
  recordAgmOperatorActivity(operatorName, "Reopened registration", record.fullName, record.branch);
  apiRecordActivity(
    "AGM Registration Reopened",
    `${operatorName} reopened AGM registration for ${record.fullName}.`,
  );
  dispatchAgmUpdated();
  return { ...record };
}

export async function apiCorrectAgmRegistration(
  input: AgmRegistrationCorrectionInput,
): Promise<AgmShareholderRecord> {
  const actor = await getAgmActor();
  const token = getStoredAgmSessionToken();
  if (actor && token) {
    const activeYear = getStoredAgmYear();
    const registration = await actor.agmGetRegistrationByShareholder(activeYear, input.shareholderId);
    const registrationRecord = Array.isArray(registration)
      ? (registration[0] as Record<string, unknown> | undefined)
      : (registration as Record<string, unknown> | null);
    if (!registrationRecord?.id) {
      throw new Error("No live AGM registration was found for this shareholder.");
    }
    unwrapAgmResult(
      await actor.agmUpdateShareholderContact(
        activeYear,
        input.shareholderId,
        input.phone.trim() ? [input.phone.trim()] : [],
        input.ghanaCardId.trim().toUpperCase(),
        token,
      ),
    );
    unwrapAgmResult(
      await actor.agmUpdateRegistration(
        activeYear,
        String(registrationRecord.id),
        {
          notes: [],
          registrationType: [input.mode === "proxy" ? { Proxy: null } : { InPerson: null }],
          verificationCode: [input.verificationCode.trim()],
          proxyData:
            input.mode === "proxy"
              ? [
                  {
                    proxyName: input.proxyName?.trim() || "Proxy Representative",
                    proxyContact: input.proxyPhone?.trim() || input.phone.trim(),
                    proxyProofKey: [],
                  },
                ]
              : [],
        },
        token,
      ),
    );
    const records = await fetchLiveAgmShareholders();
    const updated = records?.find((item) => item.id === input.shareholderId);
    if (!updated) {
      throw new Error("The AGM registration was corrected but the live record could not be refreshed.");
    }
    dispatchAgmUpdated();
    return updated;
  }

  await delay(180);
  const record = _agmShareholders.find((item) => item.id === input.shareholderId);
  if (!record) {
    throw new Error("The selected AGM shareholder could not be found.");
  }
  record.registrationType = input.mode === "proxy" ? "Proxy" : "In Person";
  record.phone = input.phone.trim();
  record.ghanaCardId = input.ghanaCardId.trim().toUpperCase();
  record.verificationCode = input.verificationCode.trim();
  record.proxyName =
    input.mode === "proxy" ? input.proxyName?.trim() || undefined : undefined;
  record.proxyPhone =
    input.mode === "proxy" ? input.proxyPhone?.trim() || undefined : undefined;
  persistContentCache(AGM_SHAREHOLDERS_STORE_KEY, _agmShareholders);
  recordAgmOperatorActivity(
    input.operatorName,
    "Corrected registration",
    record.fullName,
    record.branch,
  );
  apiRecordActivity(
    "AGM Registration Corrected",
    `${input.operatorName} corrected AGM registration for ${record.fullName}.`,
  );
  dispatchAgmUpdated();
  return { ...record };
}

export async function apiRegisterAgmShareholder(
  input: AgmRegistrationInput,
): Promise<AgmShareholderRecord> {
  const actor = await getAgmActor();
  const token = getStoredAgmSessionToken();
  if (actor && token) {
    const activeYear = getStoredAgmYear();
    unwrapAgmResult<Record<string, unknown>>(
      await actor.agmRegisterShareholder(
        activeYear,
        input.shareholderId,
        input.mode === "proxy" ? { Proxy: null } : { InPerson: null },
        input.mode === "proxy"
          ? [
              {
                proxyName: input.proxyName?.trim() || "Proxy Representative",
                proxyContact: input.proxyPhone?.trim() || input.phone.trim(),
                proxyProofKey: [],
              },
            ]
          : [],
        token,
      ),
    );
    await actor.agmUpdateShareholderContact(
      activeYear,
      input.shareholderId,
      input.phone.trim() ? [input.phone.trim()] : [],
      input.ghanaCardId.trim().toUpperCase(),
      token,
    );
    const registration = await actor.agmGetRegistrationByShareholder(activeYear, input.shareholderId);
    const registrationRecord = Array.isArray(registration)
      ? (registration[0] as Record<string, unknown> | undefined)
      : (registration as Record<string, unknown> | null);
    if (registrationRecord?.id) {
      await actor.agmUpdateRegistration(
        activeYear,
        String(registrationRecord.id),
        {
          notes: [buildRegistrationNotes([
            ["AGM Year", getStoredAgmYear()],
            ["Attendance Type", input.mode === "in-person" ? "In Person" : "Proxy"],
            ["Contact Number", input.phone.trim()],
            ["Ghana Card ID Number", input.ghanaCardId.trim().toUpperCase()],
            ["Verification Code", input.verificationCode.trim()],
            ["Chit Number", input.chitNumber.trim()],
          ])],
          registrationType: [input.mode === "proxy" ? { Proxy: null } : { InPerson: null }],
          verificationCode: [input.verificationCode.trim()],
          proxyData:
            input.mode === "proxy"
              ? [
                  {
                    proxyName: input.proxyName?.trim() || "Proxy Representative",
                    proxyContact: input.proxyPhone?.trim() || input.phone.trim(),
                    proxyProofKey: [],
                  },
                ]
              : [],
        },
        token,
      );
    }
    const records = await fetchLiveAgmShareholders();
    const updated = records?.find((item) => item.id === input.shareholderId);
    if (!updated) {
      throw new Error("The AGM registration was saved but could not be refreshed.");
    }
    dispatchAgmUpdated();
    apiRecordActivity(
      "AGM Registration Completed",
      `${updated.fullName} registered as ${updated.registrationType} for AGM ${updated.branch}.`,
    );
    return updated;
  }

  await delay(250);
  const record = _agmShareholders.find((item) => item.id === input.shareholderId);
  if (!record) {
    throw new Error("The selected AGM shareholder could not be found.");
  }

  const timestamp = new Date().toISOString();
  record.phone = input.phone.trim();
  record.ghanaCardId = input.ghanaCardId.trim().toUpperCase();
  record.registrationType = input.mode === "proxy" ? "Proxy" : "In Person";
  record.verificationCode = input.verificationCode.trim();
  record.registeredBy = input.operatorName.trim() || "AGM Operator";
  record.registeredAt = timestamp;
  record.checkedInAt = timestamp;
  record.proxyName =
    input.mode === "proxy" ? input.proxyName?.trim() || undefined : undefined;
  record.proxyPhone =
    input.mode === "proxy" ? input.proxyPhone?.trim() || undefined : undefined;

  persistContentCache(AGM_SHAREHOLDERS_STORE_KEY, _agmShareholders);
  dispatchAgmUpdated();

  apiRecordActivity(
    "AGM Registration Completed",
    `${record.fullName} registered as ${record.registrationType} for AGM ${record.branch}.`,
  );
  await apiLogAction(
    record.registeredBy,
    "AGM_REGISTER_SHAREHOLDER",
    `${record.fullName} (${input.chitNumber.trim()})`,
    "127.0.0.1",
  );

  return { ...record };
}

export async function apiCheckInAgmShareholder(
  input: AgmCheckInInput,
): Promise<AgmShareholderRecord> {
  const actor = await getAgmActor();
  const token = getStoredAgmSessionToken();
  if (actor && token) {
    const activeYear = getStoredAgmYear();
    const registration = await actor.agmGetRegistrationByShareholder(activeYear, input.shareholderId);
    const registrationRecord = Array.isArray(registration)
      ? (registration[0] as Record<string, unknown> | undefined)
      : (registration as Record<string, unknown> | null);
    if (!registrationRecord?.id) {
      throw new Error("No completed AGM registration was found for this shareholder.");
    }
    unwrapAgmResult(
      await actor.agmCheckInShareholder(
        activeYear,
        input.shareholderId,
        String(registrationRecord.id),
        input.method === "qr"
          ? { QRScan: null }
          : input.method === "quick"
            ? { ManualQuick: null }
            : { Manual: null },
        token,
      ),
    );
    const records = await fetchLiveAgmShareholders();
    const updated = records?.find((item) => item.id === input.shareholderId);
    if (!updated) {
      throw new Error("The AGM check-in was saved but the live record could not be refreshed.");
    }
    dispatchAgmUpdated();
    apiRecordActivity(
      "AGM Check-In Completed",
      `${updated.fullName} checked in for AGM ${updated.branch}.`,
    );
    return updated;
  }

  const localRecord = _agmShareholders.find((item) => item.id === input.shareholderId);
  if (!localRecord) {
    throw new Error("The selected AGM shareholder could not be found.");
  }
  localRecord.checkedInAt = new Date().toISOString();
  persistContentCache(AGM_SHAREHOLDERS_STORE_KEY, _agmShareholders);
  dispatchAgmUpdated();
  return { ...localRecord };
}

export function apiExportIncidentsCsv(incidents: IncidentReport[]): string {
  const headers = [
    "ID",
    "Date",
    "Agency",
    "Reporter",
    "Contact",
    "Category",
    "Description",
    "Status",
  ];
  const rows = incidents.map((i) => [
    String(i.id),
    new Date(Number(i.createdAt)).toLocaleDateString("en-GB"),
    i.agency ?? "",
    i.reporterName,
    i.contact ?? "",
    i.issueCategory ?? i.subject,
    `"${i.description.replace(/"/g, '""')}"`,
    i.status,
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function apiExportAmendmentsCsv(amendments: ProfileAmendment[]): string {
  const headers = [
    "ID",
    "Date",
    "Agency",
    "Name",
    "Phone",
    "Username",
    "Request Type",
    "Details",
    "Status",
  ];
  const rows = amendments.map((a) => [
    String(a.id),
    new Date(Number(a.createdAt)).toLocaleDateString("en-GB"),
    a.agency ?? "",
    a.fullname ?? a.requesterName,
    a.phone ?? "",
    a.t24Username ?? "",
    a.requestType ?? a.field,
    `"${`${a.newRole ?? ""} ${a.deptChange ?? ""} ${a.transferLocation ?? ""}`.trim().replace(/"/g, '""')}"`,
    a.status,
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

// ── Audit Logs ────────────────────────────────────────────────────────────────
const SEEDED_AUDIT_LOGS: AuditLog[] = [
  {
    id: 1,
    actorId: "mock-user-1",
    actorName: "Sarah Mensah",
    action: "LOGIN",
    target: "System",
    ipAddress: "192.168.1.10",
    timestamp: BigInt(Date.now() - 1800000),
  },
  {
    id: 2,
    actorId: "mock-user-2",
    actorName: "Emmanuel Asante",
    action: "UPDATE_STAFF",
    target: "Abena Ofori",
    ipAddress: "192.168.1.22",
    timestamp: BigInt(Date.now() - 3600000),
  },
  {
    id: 3,
    actorId: "mock-user-1",
    actorName: "Sarah Mensah",
    action: "CREATE_ANNOUNCEMENT",
    target: "BCB Annual General Meeting 2026",
    ipAddress: "192.168.1.10",
    timestamp: BigInt(Date.now() - 86400000),
  },
];

const _auditLogs: AuditLog[] = loadContentCache(
  AUDIT_LOGS_STORE_KEY,
  SEEDED_AUDIT_LOGS,
  deserializeAuditLog,
);

export async function apiLogAction(
  actorName: string,
  action: string,
  target: string,
  ipAddress: string,
): Promise<void> {
  try {
    const payload = await postMailApiJson("/audit-logs", {
      action,
      target,
      ipAddress,
    });
    const rawLog = payload.log as Record<string, unknown> | undefined;
    if (rawLog) {
      _auditLogs.unshift(deserializeAuditLog(rawLog));
      persistContentCache(AUDIT_LOGS_STORE_KEY, _auditLogs);
    }
    return;
  } catch {
    // Keep local logging as a fallback when the backend is not reachable.
  }
  _auditLogs.unshift({
    id: _auditLogs.length + 1,
    actorId: "current-user",
    actorName,
    action,
    target,
    ipAddress,
    timestamp: BigInt(Date.now()),
  });
  persistContentCache(AUDIT_LOGS_STORE_KEY, _auditLogs);
}

export async function apiGetAuditLogs(): Promise<AuditLog[]> {
  try {
    const payload = await getMailApiJson("/audit-logs");
    const logs = Array.isArray(payload.logs)
      ? (payload.logs as Record<string, unknown>[]).map(deserializeAuditLog)
      : [];
    _auditLogs.splice(0, _auditLogs.length, ...logs);
    persistContentCache(AUDIT_LOGS_STORE_KEY, _auditLogs);
  } catch {
    await delay(400);
  }
  return [..._auditLogs].sort(
    (a, b) => Number(b.timestamp) - Number(a.timestamp),
  );
}

export function apiGetCachedAuditLogs(): AuditLog[] {
  return [..._auditLogs].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
}

export async function apiDeleteAuditLog(id: number): Promise<ApiResult<null>> {
  try {
    await postMailApi(`/audit-logs/${id}/delete`, {});
  } catch (error) {
    await delay(200);
    const idx = _auditLogs.findIndex((l) => l.id === id);
    if (idx < 0) {
      return err(error instanceof Error ? error.message : "Log entry not found");
    }
    _auditLogs.splice(idx, 1);
    persistContentCache(AUDIT_LOGS_STORE_KEY, _auditLogs);
    return ok(null);
  }
  const idx = _auditLogs.findIndex((l) => l.id === id);
  if (idx >= 0) _auditLogs.splice(idx, 1);
  persistContentCache(AUDIT_LOGS_STORE_KEY, _auditLogs);
  return ok(null);
}

export async function apiDeleteAuditLogs(
  ids: number[],
): Promise<ApiResult<null>> {
  try {
    await postMailApi("/audit-logs/delete", { ids });
  } catch (error) {
    await delay(300);
    let removed = false;
    for (const id of ids) {
      const idx = _auditLogs.findIndex((l) => l.id === id);
      if (idx >= 0) {
        _auditLogs.splice(idx, 1);
        removed = true;
      }
    }
    if (removed) persistContentCache(AUDIT_LOGS_STORE_KEY, _auditLogs);
    return removed || ids.length === 0
      ? ok(null)
      : err(error instanceof Error ? error.message : "Log entry not found");
  }
  for (const id of ids) {
    const idx = _auditLogs.findIndex((l) => l.id === id);
    if (idx >= 0) _auditLogs.splice(idx, 1);
  }
  persistContentCache(AUDIT_LOGS_STORE_KEY, _auditLogs);
  return ok(null);
}

// ── Util ──────────────────────────────────────────────────────────────────────

export async function apiDownloadProductionBackup(): Promise<ApiResult<string>> {
  try {
    const token = getStoredSessionToken();
    const response = await fetch(`${MAIL_API_URL}/backup/export`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      if (response.status === 401) {
        handleSessionExpired();
        return err("Session expired. Please log in again.");
      }
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      return err(data.error || "Backup could not be downloaded");
    }
    const blob = await response.blob();
    const headerName =
      response.headers.get("X-Backup-Filename") ||
      response.headers
        .get("Content-Disposition")
        ?.match(/filename="?(.*?)"?$/)?.[1];
    const filename = headerName || `bawjiase-portal-backup-${Date.now()}.json`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return ok(filename);
  } catch (error) {
    return err(
      error instanceof Error ? error.message : "Backup could not be downloaded",
    );
  }
}

function delay(ms: number) {
  void ms;
  return Promise.resolve();
}
