/**
 * Auth Abstraction Layer
 *
 * Auto-detects auth provider from environment:
 * - NEON_AUTH_BASE_URL set → Neon Auth (hosted)
 * - Otherwise → local JWT fallback (Phase 2)
 *
 * Server-side only. For client-side, use ./client.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export type AuthProvider = "neon" | "local";
export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

export interface Session {
  user: SessionUser;
}

export const SESSION_COOKIE_NAME = "better-auth.session_token";

/**
 * Detect which auth provider to use based on environment
 */
export function getAuthProvider(): AuthProvider {
  if (process.env.NEON_AUTH_BASE_URL) {
    return "neon";
  }
  return "local";
}

/**
 * Get the current session (server-side)
 *
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<Session | null> {
  const provider = getAuthProvider();

  if (provider === "neon") {
    const { getNeonSession } = await import("./neon");
    return getNeonSession();
  }

  // Phase 2: Local JWT auth
  // For now, check for a dev bypass if no auth provider is configured
  if (process.env.CONDUCTOR_AUTH_BYPASS === "true") {
    if (process.env.NODE_ENV === "production") {
      console.error("[AUTH] CONDUCTOR_AUTH_BYPASS must not be used in production");
      return null;
    }
    return {
      user: {
        id: "dev-user",
        email: "dev@conductor.local",
        name: "Dev User",
        image: null,
      },
    };
  }

  return null;
}

/**
 * Require a valid session or return a 401 response.
 * Use in API route handlers.
 */
export async function requireSession(
  _request?: NextRequest,
): Promise<{ session: Session } | { error: NextResponse }> {
  const session = await getSession();

  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }

  return { session };
}

/**
 * Check if a session cookie exists (for middleware - lightweight check)
 */
export async function hasSessionCookie(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME);
    return !!cookie?.value;
  } catch {
    return false;
  }
}

/**
 * Check if auth is configured (any provider)
 */
export function isAuthConfigured(): boolean {
  return !!process.env.NEON_AUTH_BASE_URL || process.env.CONDUCTOR_AUTH_BYPASS === "true";
}
