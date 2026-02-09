import { SQLiteStateStore } from "@conductor/state";
import { D1StateStore } from "./d1-store";

// Stub type for D1Database (Cloudflare Workers type)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Database = any;

// Environment detection
export type Platform = "local" | "cloudflare" | "firebase";

/**
 * Detect the current platform based on environment
 */
export function detectPlatform(): Platform {
  // Explicit platform from environment
  const explicitPlatform = process.env.CONDUCTOR_PLATFORM;
  if (explicitPlatform === "cloudflare") return "cloudflare";
  if (explicitPlatform === "firebase") return "firebase";

  // Auto-detect Cloudflare
  if (process.env.CONDUCTOR_ENV === "cloudflare") return "cloudflare";

  // Auto-detect Firebase
  if (
    process.env.FIREBASE_CONFIG ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.GCLOUD_PROJECT ||
    process.env.K_SERVICE // Cloud Run/Functions
  ) {
    return "firebase";
  }

  return "local";
}

// Local SQLite store singleton
let localStore: SQLiteStateStore | null = null;

/**
 * Get the appropriate state store based on environment
 * For local/Node.js: returns SQLiteStateStore
 * For Cloudflare: caller must pass D1 database binding
 */
export function getStateStore(
  d1?: D1Database,
): SQLiteStateStore | D1StateStore {
  // If D1 database is provided, use D1 store
  if (d1) {
    return new D1StateStore(d1);
  }

  // For local development, use SQLite
  if (!localStore) {
    const dbPath = process.env.CONDUCTOR_DB || "./conductor.db";
    localStore = new SQLiteStateStore({ dbPath });
  }
  return localStore;
}

/**
 * Get project ID from environment
 */
export function getProjectId(): string {
  return process.env.CONDUCTOR_PROJECT_ID || "default";
}

/**
 * Helper to get D1 binding from request context (Cloudflare)
 * This should be called from API routes with access to the platform context
 */
export function getD1FromContext(context: {
  env?: { DB?: D1Database };
}): D1Database | undefined {
  return context?.env?.DB;
}

/**
 * Type guard to check if store is D1-based (async) or SQLite (sync)
 */
export function isD1Store(
  store: SQLiteStateStore | D1StateStore,
): store is D1StateStore {
  return store instanceof D1StateStore;
}

// Re-export types
export { D1StateStore } from "./d1-store";
export type { SQLiteStateStore };
