/**
 * Server-Sent Events endpoint for real-time dashboard updates
 *
 * Usage: EventSource('/api/events')
 */

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getStateStore, getProjectId, type SQLiteStateStore } from "@/lib/db";
import {
  createSSEResponse,
  formatSSEEvent,
  createHeartbeat,
  diffSnapshots,
  type StateSnapshot,
  type StreamEvent,
} from "@/lib/event-stream";
import { requireSession } from "@/lib/auth";

// Polling interval in milliseconds
const POLL_INTERVAL = 1000;
// Heartbeat interval in milliseconds
const HEARTBEAT_INTERVAL = 15000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const encoder = new TextEncoder();
  let isConnected = true;
  let previousSnapshot: StateSnapshot | null = null;

  // Create the stream
  const stream = new ReadableStream({
    async start(controller) {
      // In Node.js runtime, we always use SQLiteStateStore (sync)
      const store = getStateStore() as SQLiteStateStore;
      const projectId = getProjectId();

      // Send initial connection event
      const connectEvent: StreamEvent = {
        type: "heartbeat",
        timestamp: new Date().toISOString(),
        data: { status: "connected", projectId },
      };
      controller.enqueue(encoder.encode(formatSSEEvent(connectEvent)));

      // Heartbeat timer
      const heartbeatTimer = setInterval(() => {
        if (!isConnected) return;
        try {
          controller.enqueue(encoder.encode(formatSSEEvent(createHeartbeat())));
        } catch {
          // Connection closed
          isConnected = false;
        }
      }, HEARTBEAT_INTERVAL);

      // Polling timer for state changes
      const pollTimer = setInterval(async () => {
        if (!isConnected) return;

        try {
          // Get current state snapshot
          const tasks = store.listTasks(projectId).map((t) => ({
            id: t.id,
            status: t.status,
            updatedAt: t.createdAt?.toISOString(), // Use createdAt as proxy for updatedAt
          }));

          const agents = store.listAgents(projectId).map((a) => ({
            id: a.id,
            status: a.status,
            lastHeartbeat: a.lastHeartbeat?.toISOString(),
          }));

          const costEvents = store.getCostEvents(projectId);
          const totalCost = costEvents.reduce((sum, e) => sum + e.cost, 0);

          const currentSnapshot: StateSnapshot = {
            tasks,
            agents,
            totalCost,
            activeLocks: store.listActiveLocks(projectId).length,
          };

          // Diff and emit events
          const events = diffSnapshots(previousSnapshot, currentSnapshot);
          for (const event of events) {
            controller.enqueue(encoder.encode(formatSSEEvent(event)));
          }

          previousSnapshot = currentSnapshot;
        } catch (error) {
          console.error("SSE poll error:", error);
        }
      }, POLL_INTERVAL);

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        isConnected = false;
        clearInterval(heartbeatTimer);
        clearInterval(pollTimer);
        controller.close();
      });
    },
  });

  return createSSEResponse(stream);
}
