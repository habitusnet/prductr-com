/**
 * Neon Auth catch-all route handler
 *
 * Handles: sign-in, sign-up, sign-out, session, callback, etc.
 * Lazily initializes to avoid build-time errors when env vars aren't set.
 */

import { createNeonAuth } from "@neondatabase/auth/next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type HandlerParams = { params: Promise<{ path: string[] }> };

let cachedHandler: ReturnType<ReturnType<typeof createNeonAuth>["handler"]> | null =
  null;

function getHandler() {
  if (!cachedHandler) {
    if (!process.env.NEON_AUTH_BASE_URL) {
      throw new Error("NEON_AUTH_BASE_URL environment variable is required");
    }
    if (!process.env.NEON_AUTH_COOKIE_SECRET) {
      throw new Error(
        "NEON_AUTH_COOKIE_SECRET environment variable is required (minimum 32 characters)",
      );
    }
    const auth = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL,
      cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET,
      },
    });
    cachedHandler = auth.handler();
  }
  return cachedHandler;
}

export async function GET(request: Request, context: HandlerParams) {
  return getHandler().GET(request, context);
}

export async function POST(request: Request, context: HandlerParams) {
  return getHandler().POST(request, context);
}

export async function PUT(request: Request, context: HandlerParams) {
  return getHandler().PUT(request, context);
}

export async function DELETE(request: Request, context: HandlerParams) {
  return getHandler().DELETE(request, context);
}

export async function PATCH(request: Request, context: HandlerParams) {
  return getHandler().PATCH(request, context);
}
