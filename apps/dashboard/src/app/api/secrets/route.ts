/**
 * Secrets API
 *
 * GET  /api/secrets - List user's secrets (metadata only, no values)
 * POST /api/secrets - Add or update an encrypted secret
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getDatabaseContext } from "@/lib/db-context";
import { SecretCreateSchema, validateBody } from "@/lib/api-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { userSecrets } = getDatabaseContext();
    const secrets = await userSecrets.list(auth.session.user.id);

    return NextResponse.json({ secrets });
  } catch (error) {
    console.error("Failed to list secrets:", error);
    return NextResponse.json(
      { error: "Failed to list secrets", secrets: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();

    const parsed = validateBody(SecretCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { name, value, provider } = parsed.data;

    const { userSecrets } = getDatabaseContext();
    await userSecrets.set(auth.session.user.id, name, value, { provider });

    return NextResponse.json({
      success: true,
      message: `Secret '${name}' saved`,
    });
  } catch (error) {
    console.error("Failed to save secret:", error);
    return NextResponse.json(
      { error: "Failed to save secret" },
      { status: 500 },
    );
  }
}
