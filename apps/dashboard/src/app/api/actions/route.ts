import { NextRequest, NextResponse } from "next/server";
import {
  getApiContext,
  getPendingActions,
  resolveConflict,
  releaseLock,
  updateTask,
  updateAgentStatus,
  listAgents,
} from "@/lib/edge-api-helpers";
import { requireSession } from "@/lib/auth";
import { ActionBodySchema, validateBody } from "@/lib/api-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Types for pending actions
interface PendingConflict {
  id: string;
  type: "conflict";
  filePath: string;
  agents: string[];
  strategy: string;
  createdAt: string;
}

interface PendingApproval {
  id: string;
  type: "approval";
  title: string;
  description: string;
  requestedBy: string;
  taskId?: string;
  createdAt: string;
}

interface PendingEscalation {
  id: string;
  type: "escalation";
  title: string;
  description: string;
  agentId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
}

interface FileLock {
  filePath: string;
  agentId: string;
  lockedAt: string;
  expiresAt: string;
}

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const {
      conflicts: rawConflicts,
      locks,
      blockedTasks,
      agents,
    } = await getPendingActions(ctx);

    const conflicts: PendingConflict[] = rawConflicts.map((c) => ({
      id: c.id,
      type: "conflict" as const,
      filePath: c.filePath,
      agents: c.agents,
      strategy: c.strategy,
      createdAt: c.createdAt,
    }));

    const escalations: PendingEscalation[] = blockedTasks.map((task) => ({
      id: task.id,
      type: "escalation" as const,
      title: `Task blocked: ${task.title}`,
      description: task.description || "Task is blocked and requires attention",
      agentId: task.assignedTo || "unassigned",
      severity:
        task.priority === "critical"
          ? "critical"
          : task.priority === "high"
            ? "high"
            : "medium",
      createdAt: task.createdAt.toISOString(),
    }));

    // Mock approvals for demo (in production, these would come from a pending_approvals table)
    const approvals: PendingApproval[] = [];

    // Get agent stats
    const workingAgents = agents.filter((a) => a.status === "working");
    const blockedAgents = agents.filter((a) => a.status === "blocked");

    return NextResponse.json({
      conflicts,
      approvals,
      escalations,
      locks,
      summary: {
        totalPending: conflicts.length + approvals.length + escalations.length,
        conflictCount: conflicts.length,
        approvalCount: approvals.length,
        escalationCount: escalations.length,
        lockCount: locks.length,
        workingAgents: workingAgents.length,
        blockedAgents: blockedAgents.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch actions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch actions",
        conflicts: [],
        approvals: [],
        escalations: [],
        locks: [],
        summary: { totalPending: 0 },
      },
      { status: 500 },
    );
  }
}

// Execute an action
export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const body = await request.json();

    const parsed = validateBody(ActionBodySchema, body);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { actionType, actionId, resolution, data } = parsed.data as any;

    switch (actionType) {
      case "resolve_conflict": {
        // resolution: 'accept_first' | 'accept_second' | 'merge' | 'defer'
        await resolveConflict(ctx, actionId, resolution);
        return NextResponse.json({
          success: true,
          message: `Conflict resolved: ${resolution}`,
        });
      }

      case "force_release_lock": {
        const { filePath, agentId } = data;
        await releaseLock(ctx, filePath, agentId);
        return NextResponse.json({
          success: true,
          message: `Lock released for ${filePath}`,
        });
      }

      case "unblock_task": {
        await updateTask(ctx, actionId, { status: "pending", blockedBy: [] });
        return NextResponse.json({ success: true, message: "Task unblocked" });
      }

      case "cancel_task": {
        await updateTask(ctx, actionId, { status: "cancelled" });
        return NextResponse.json({ success: true, message: "Task cancelled" });
      }

      case "reassign_task": {
        const { newAgentId } = data;
        await updateTask(ctx, actionId, {
          assignedTo: newAgentId,
          status: "pending",
        });
        return NextResponse.json({
          success: true,
          message: `Task reassigned to ${newAgentId}`,
        });
      }

      case "pause_agent": {
        await updateAgentStatus(ctx, data.agentId, "blocked");
        return NextResponse.json({ success: true, message: "Agent paused" });
      }

      case "resume_agent": {
        await updateAgentStatus(ctx, data.agentId, "idle");
        return NextResponse.json({ success: true, message: "Agent resumed" });
      }

      case "pause_all": {
        const agents = await listAgents(ctx);
        for (const agent of agents) {
          if (agent.status === "working" || agent.status === "idle") {
            await updateAgentStatus(ctx, agent.id, "blocked");
          }
        }
        return NextResponse.json({
          success: true,
          message: "All agents paused",
        });
      }

      case "resume_all": {
        const agents = await listAgents(ctx);
        for (const agent of agents) {
          if (agent.status === "blocked") {
            await updateAgentStatus(ctx, agent.id, "idle");
          }
        }
        return NextResponse.json({
          success: true,
          message: "All agents resumed",
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action type: ${actionType}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Failed to execute action:", error);
    return NextResponse.json(
      { error: "Failed to execute action" },
      { status: 500 },
    );
  }
}
