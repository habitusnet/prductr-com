/**
 * Client-side auth setup for Neon Auth
 *
 * Re-exports authClient and useSession for use in React components.
 */

"use client";

import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();

export const useSession = authClient.useSession;
