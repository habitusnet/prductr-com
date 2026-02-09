import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/edge-api-helpers";
import { requireSession } from "@/lib/auth";
import type { SQLiteStateStore } from "@conductor/state";
import { ZoneConfigUpdateSchema, validateBody } from "@/lib/api-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const store = ctx.store as SQLiteStateStore;

    const config = store.getProjectZoneConfig(ctx.projectId);

    return NextResponse.json({ config: config || null });
  } catch (error) {
    console.error("Failed to fetch zone config:", error);
    return NextResponse.json(
      { error: "Failed to fetch zone configuration", config: null },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const store = ctx.store as SQLiteStateStore;
    const body = await request.json();

    const parsed = validateBody(ZoneConfigUpdateSchema, body);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    store.setProjectZoneConfig(ctx.projectId, parsed.data.config);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update zone config:", error);
    return NextResponse.json(
      { error: "Failed to update zone configuration" },
      { status: 500 },
    );
  }
}
