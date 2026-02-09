import { NextRequest, NextResponse } from "next/server";
import { getApiContext, listTasks } from "@/lib/edge-api-helpers";
import { requireSession } from "@/lib/auth";
import { TaskQuerySchema, validateBody } from "@/lib/api-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const searchParams = request.nextUrl.searchParams;
    const rawParams = {
      status: searchParams.get("status") || undefined,
      priority: searchParams.get("priority") || undefined,
      assignedTo: searchParams.get("assignedTo") || undefined,
    };

    const parsed = validateBody(TaskQuerySchema, rawParams);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const tasks = await listTasks(ctx, parsed.data);

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks", tasks: [] },
      { status: 500 },
    );
  }
}

// Note: POST for task creation is not supported on edge runtime
// as it requires sync SQLite operations. Use the MCP server for task creation.
