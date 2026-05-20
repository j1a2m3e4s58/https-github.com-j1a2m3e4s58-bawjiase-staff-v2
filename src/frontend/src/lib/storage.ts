// Local storage helpers for offline caching and session persistence

const SESSION_TOKEN_KEY = "agm_session_token";
const SESSION_USER_KEY = "agm_session_user";
const SETTINGS_CACHE_KEY = "agm_settings_cache";
const METRICS_CACHE_KEY = "agm_metrics_cache";
const IMPORT_FILE_LIBRARY_KEY = "agm_import_file_library";

export interface ImportFileLibraryItem {
  id: string;
  name: string;
  size?: number;
  type?: string;
  addedAt: string;
  updatedAt: string;
  lastImportedAt?: string;
}

const DEFAULT_IMPORT_FILE_LIBRARY: ImportFileLibraryItem[] = [
  {
    id: "bawjiase-community-bank-share-list",
    name: "BAWJIASE COMMUNITY BANK SHARE LIST.xlsx",
    addedAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
  },
];

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const storage = {
  // Session
  getSessionToken(): string | null {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  },
  setSessionToken(token: string): void {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  },
  clearSession(): void {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
  },

  // User cache
  getUser<T>(): T | null {
    return readJson<T>(SESSION_USER_KEY);
  },
  setUser<T>(user: T): void {
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  },

  // Settings cache
  getSettingsCache<T>(): T | null {
    return readJson<T>(SETTINGS_CACHE_KEY);
  },
  setSettingsCache<T>(settings: T): void {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  },

  // Metrics cache
  getMetricsCache<T>(): T | null {
    return readJson<T>(METRICS_CACHE_KEY);
  },
  setMetricsCache<T>(metrics: T): void {
    localStorage.setItem(METRICS_CACHE_KEY, JSON.stringify(metrics));
  },

  getImportFileLibrary(): ImportFileLibraryItem[] {
    const items = readJson<ImportFileLibraryItem[]>(IMPORT_FILE_LIBRARY_KEY);
    if (!items || items.length === 0) {
      localStorage.setItem(
        IMPORT_FILE_LIBRARY_KEY,
        JSON.stringify(DEFAULT_IMPORT_FILE_LIBRARY),
      );
      return [...DEFAULT_IMPORT_FILE_LIBRARY];
    }

    const merged = [...items];
    for (const seeded of DEFAULT_IMPORT_FILE_LIBRARY) {
      if (!merged.some((item) => item.name === seeded.name)) {
        merged.push(seeded);
      }
    }

    localStorage.setItem(IMPORT_FILE_LIBRARY_KEY, JSON.stringify(merged));
    return merged;
  },
  setImportFileLibrary(items: ImportFileLibraryItem[]): void {
    localStorage.setItem(IMPORT_FILE_LIBRARY_KEY, JSON.stringify(items));
  },
};
