/**
 * Server-Sent Events (SSE) utilities for real-time dashboard updates
 */

export type EventType =
  | "task:created"
  | "task:updated"
  | "task:completed"
  | "task:failed"
  | "agent:registered"
  | "agent:heartbeat"
  | "agent:offline"
  | "sandbox:started"
  | "sandbox:stopped"
  | "cost:recorded"
  | "conflict:detected"
  | "lock:acquired"
  | "lock:released"
  | "heartbeat";

export interface StreamEvent {
  type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Create an SSE response with proper headers
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

/**
 * Format an event for SSE transmission
 */
export function formatSSEEvent(event: StreamEvent): string {
  const data = JSON.stringify(event);
  return `event: ${event.type}\ndata: ${data}\n\n`;
}

/**
 * Create a heartbeat event
 */
export function createHeartbeat(): StreamEvent {
  return {
    type: "heartbeat",
    timestamp: new Date().toISOString(),
    data: { status: "connected" },
  };
}

/**
 * State snapshot for change detection
 */
export interface StateSnapshot {
  tasks: { id: string; status: string; updatedAt?: string }[];
  agents: { id: string; status: string; lastHeartbeat?: string }[];
  totalCost: number;
  activeLocks: number;
}

/**
 * Compare snapshots and generate events
 */
export function diffSnapshots(
  previous: StateSnapshot | null,
  current: StateSnapshot,
): StreamEvent[] {
  const events: StreamEvent[] = [];
  const now = new Date().toISOString();

  if (!previous) {
    // Initial snapshot - no events needed
    return events;
  }

  // Check for task changes
  const prevTaskMap = new Map(previous.tasks.map((t) => [t.id, t]));
  const currTaskMap = new Map(current.tasks.map((t) => [t.id, t]));

  for (const task of current.tasks) {
    const prevTask = prevTaskMap.get(task.id);
    if (!prevTask) {
      events.push({
        type: "task:created",
        timestamp: now,
        data: { taskId: task.id, status: task.status },
      });
    } else if (prevTask.status !== task.status) {
      const eventType =
        task.status === "completed"
          ? "task:completed"
          : task.status === "failed"
            ? "task:failed"
            : "task:updated";
      events.push({
        type: eventType,
        timestamp: now,
        data: {
          taskId: task.id,
          previousStatus: prevTask.status,
          newStatus: task.status,
        },
      });
    }
  }

  // Check for agent changes
  const prevAgentMap = new Map(previous.agents.map((a) => [a.id, a]));

  for (const agent of current.agents) {
    const prevAgent = prevAgentMap.get(agent.id);
    if (!prevAgent) {
      events.push({
        type: "agent:registered",
        timestamp: now,
        data: { agentId: agent.id, status: agent.status },
      });
    } else if (prevAgent.status !== agent.status) {
      events.push({
        type: agent.status === "offline" ? "agent:offline" : "agent:heartbeat",
        timestamp: now,
        data: { agentId: agent.id, status: agent.status },
      });
    }
  }

  // Check for cost changes
  if (current.totalCost > previous.totalCost) {
    events.push({
      type: "cost:recorded",
      timestamp: now,
      data: {
        previousTotal: previous.totalCost,
        newTotal: current.totalCost,
        delta: current.totalCost - previous.totalCost,
      },
    });
  }

  // Check for lock changes
  if (current.activeLocks !== previous.activeLocks) {
    events.push({
      type:
        current.activeLocks > previous.activeLocks
          ? "lock:acquired"
          : "lock:released",
      timestamp: now,
      data: {
        previousCount: previous.activeLocks,
        newCount: current.activeLocks,
      },
    });
  }

  return events;
}
