import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/edge-api-helpers";
import { requireSession } from "@/lib/auth";
import type { SQLiteStateStore } from "@conductor/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthStatus = "healthy" | "warning" | "critical" | "offline";

function classifyHealth(secondsSinceHeartbeat: number | null): HealthStatus {
  if (secondsSinceHeartbeat === null) return "offline";
  if (secondsSinceHeartbeat >= 600) return "offline";
  if (secondsSinceHeartbeat >= 300) return "critical";
  if (secondsSinceHeartbeat >= 120) return "warning";
  return "healthy";
}

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const store = ctx.store as SQLiteStateStore;
    const agents = store.listAgents(ctx.projectId);
    const now = Date.now();

    const healthStatuses = agents.map((agent) => {
      const secondsSince = agent.lastHeartbeat
        ? Math.floor((now - agent.lastHeartbeat.getTime()) / 1000)
        : null;

      return {
        agentId: agent.id,
        agentName: agent.name,
        status: classifyHealth(secondsSince),
        lastHeartbeat: agent.lastHeartbeat?.toISOString() ?? null,
        secondsSinceHeartbeat: secondsSince,
      };
    });

    return NextResponse.json({ health: healthStatuses });
  } catch (error) {
    console.error("Failed to fetch health status:", error);
    return NextResponse.json(
      { error: "Failed to fetch health status", health: [] },
      { status: 500 },
    );
  }
}
