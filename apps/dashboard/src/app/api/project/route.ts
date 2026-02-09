import { NextResponse } from "next/server";
import { getApiContext, getProjectData, getPendingActions } from "@/lib/edge-api-helpers";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Use nodejs for local dev, edge for Cloudflare

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const { project, tasks, agents, totalSpend } = await getProjectData(ctx);

    const taskSummary = {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      claimed: tasks.filter((t) => t.status === "claimed").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
    };

    const agentSummary = {
      total: agents.length,
      idle: agents.filter((a) => a.status === "idle").length,
      working: agents.filter((a) => a.status === "working").length,
      blocked: agents.filter((a) => a.status === "blocked").length,
      offline: agents.filter((a) => a.status === "offline").length,
    };

    // Count unresolved conflicts from blocked tasks and file lock contention
    const { conflicts: rawConflicts, blockedTasks: blockedForConflicts } =
      await getPendingActions(ctx);
    const conflicts = rawConflicts.length + blockedForConflicts.length;

    return NextResponse.json({
      project: project
        ? {
            id: project.id,
            name: project.name,
            conflictStrategy: project.conflictStrategy,
          }
        : null,
      tasks: taskSummary,
      agents: agentSummary,
      budget: project?.budget
        ? {
            total: project.budget.total,
            spent: totalSpend,
            remaining: project.budget.total - totalSpend,
            percentUsed:
              project.budget.total > 0
                ? ((totalSpend / project.budget.total) * 100).toFixed(1)
                : "0",
            alertThreshold: project.budget.alertThreshold,
          }
        : null,
      conflicts,
    });
  } catch (error) {
    console.error("Failed to fetch project status:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch project status",
        project: null,
        tasks: {
          total: 0,
          pending: 0,
          claimed: 0,
          inProgress: 0,
          completed: 0,
          failed: 0,
          blocked: 0,
        },
        agents: { total: 0, idle: 0, working: 0, blocked: 0, offline: 0 },
        budget: null,
        conflicts: 0,
      },
      { status: 500 },
    );
  }
}
