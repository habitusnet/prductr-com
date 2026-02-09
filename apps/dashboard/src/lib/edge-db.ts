/**
 * Edge-compatible database access
 * This file ONLY imports D1-compatible code, no Node.js dependencies
 */

// Stub type for D1Database (Cloudflare Workers type)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Database = any;

import { D1StateStore } from "./d1-store";

// Helper type for request context
interface CloudflareContext {
  env: { DB?: D1Database };
}

// Try to import Cloudflare's context helper (only available on Cloudflare)
let getRequestContext: (() => CloudflareContext) | null = null;
try {
  // Use dynamic require to avoid module resolution issues
  const cfModule = eval("require")("@cloudflare/next-on-pages");
  getRequestContext = cfModule.getRequestContext;
} catch {
  // Not on Cloudflare - this is expected in Node.js/dev environment
}

let d1Store: D1StateStore | null = null;

export interface EdgeApiContext {
  store: D1StateStore;
  projectId: string;
}

/**
 * Get edge-compatible API context
 * Only works on Cloudflare Workers with D1 binding
 */
export function getEdgeApiContext(): EdgeApiContext {
  if (!getRequestContext) {
    throw new Error("Edge context not available - not running on Cloudflare");
  }

  try {
    const ctx = getRequestContext();
    if (!ctx?.env?.DB) {
      throw new Error("D1 database binding not found");
    }

    if (!d1Store) {
      d1Store = new D1StateStore(ctx.env.DB);
    }

    return {
      store: d1Store,
      projectId: process.env.CONDUCTOR_PROJECT_ID || "default-project",
    };
  } catch (error) {
    throw new Error(`Failed to get edge context: ${error}`);
  }
}

/**
 * Check if we're running on Cloudflare with D1
 */
export function isEdgeRuntime(): boolean {
  if (!getRequestContext) return false;
  try {
    const ctx = getRequestContext();
    return Boolean(ctx?.env?.DB);
  } catch {
    return false;
  }
}

// Re-export D1StateStore for type convenience
export { D1StateStore };
export type {
  Project,
  Task,
  AgentProfile,
  AccessRequest,
  OnboardingConfig,
  CostEvent,
} from "./d1-store";
