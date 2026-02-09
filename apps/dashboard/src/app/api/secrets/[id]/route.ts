/**
 * Individual Secret API
 *
 * DELETE /api/secrets/[id] - Delete a secret (verify ownership)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getDatabaseContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const { secretsRepo } = getDatabaseContext();

    // Verify ownership: look up the secret and check userId
    const secret = await secretsRepo.findById(id);
    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    if (secret.userId !== auth.session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await secretsRepo.delete(id);

    return NextResponse.json({
      success: true,
      message: "Secret deleted",
    });
  } catch (error) {
    console.error("Failed to delete secret:", error);
    return NextResponse.json(
      { error: "Failed to delete secret" },
      { status: 500 },
    );
  }
}
