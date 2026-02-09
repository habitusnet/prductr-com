/**
 * Neon Auth provider implementation
 *
 * Server-side auth utilities for session retrieval.
 */

import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "better-auth.session_token";

/**
 * Get the current session from the Neon Auth cookie (server-side)
 *
 * Makes a request to the Neon Auth API to validate the session.
 */
export async function getNeonSession(): Promise<{
  user: { id: string; email: string; name: string | null; image: string | null };
} | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) {
      return null;
    }

    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    if (!baseUrl) {
      return null;
    }

    const response = await fetch(`${baseUrl}/get-session`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionCookie.value}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const session = await response.json();
    if (!session?.user) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export const AUTH_PROVIDER = "neon" as const;
