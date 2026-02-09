import { NextResponse } from "next/server";
import {
  getApiContext,
  getCostData,
  getProjectData,
} from "@/lib/edge-api-helpers";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const [{ totalSpend, events }, { project }] = await Promise.all([
      getCostData(ctx),
      getProjectData(ctx),
    ]);

    // Group costs by agent
    const byAgent: Record<string, { cost: number; tokens: number }> = {};
    for (const event of events) {
      if (!byAgent[event.agentId]) {
        byAgent[event.agentId] = { cost: 0, tokens: 0 };
      }
      byAgent[event.agentId].cost += event.cost;
      byAgent[event.agentId].tokens += event.tokensInput + event.tokensOutput;
    }

    // Group costs by day (last 7 days)
    const dailySpend: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split("T")[0];
      dailySpend[key] = 0;
    }

    for (const event of events) {
      const day = event.createdAt.toISOString().split("T")[0];
      if (dailySpend[day] !== undefined) {
        dailySpend[day] += event.cost;
      }
    }

    return NextResponse.json({
      events: events.slice(0, 50).map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      budget: project?.budget
        ? {
            total: project.budget.total,
            spent: totalSpend,
            alertThreshold: project.budget.alertThreshold,
          }
        : null,
      byAgent: Object.entries(byAgent).map(([agentId, data]) => ({
        agentId,
        cost: data.cost,
        tokens: data.tokens,
        percentage:
          totalSpend > 0 ? Math.round((data.cost / totalSpend) * 100) : 0,
      })),
      dailySpend: Object.entries(dailySpend).map(([date, amount]) => ({
        date,
        amount,
      })),
      totalSpend,
    });
  } catch (error) {
    console.error("Failed to fetch costs:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch costs",
        events: [],
        budget: null,
        byAgent: [],
        dailySpend: [],
        totalSpend: 0,
      },
      { status: 500 },
    );
  }
}
