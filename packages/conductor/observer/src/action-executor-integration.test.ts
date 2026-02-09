import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DecisionEngine } from "./decision-engine/index.js";
import { ActionExecutor } from "./action-executor/index.js";
import { ActionLogger } from "./escalation-queue/action-logger.js";
import type { DetectionEvent, AutonomousAction } from "./types.js";
import * as fs from "fs";

describe("Integration: DecisionEngine -> ActionExecutor", () => {
  let decisionEngine: DecisionEngine;
  let actionExecutor: ActionExecutor;
  let actionLogger: ActionLogger;
  let mockMcpClient: any;
  const testDbPath = "/tmp/test-action-integration.db";

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize ActionLogger with test database
    actionLogger = new ActionLogger(testDbPath);
    actionLogger.initialize();

    // Create mock MCP client
    mockMcpClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      updateTask: vi.fn().mockResolvedValue(undefined),
      unlockFile: vi.fn().mockResolvedValue(undefined),
      sendHeartbeat: vi.fn().mockResolvedValue(undefined),
    };

    // Initialize DecisionEngine with full autonomy
    decisionEngine = new DecisionEngine({ autonomyLevel: "full_auto" });

    // Initialize ActionExecutor
    actionExecutor = new ActionExecutor({
      projectId: "test-project",
      observerId: "test-observer",
      mcpClient: mockMcpClient,
      actionLogger,
    });
  });

  afterEach(() => {
    decisionEngine.dispose();
    actionExecutor.dispose();
    actionLogger.close();

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it("should execute autonomous action from decision", async () => {
    const event: DetectionEvent = {
      type: "stuck",
      agentId: "agent-1",
      sandboxId: "sandbox-1",
      timestamp: new Date(),
      silentDurationMs: 300000,
    };

    // Get decision from engine
    const { decision, metricId } = decisionEngine.processEvent(event);

    // If autonomous, extract action and execute
    if (decision.action === "autonomous") {
      const action: AutonomousAction = {
        type: decision.actionType,
        agentId: event.agentId,
        message: "Agent appears stuck, attempting recovery",
      } as AutonomousAction;

      const result = await actionExecutor.execute(action, event);
      expect(result.success).toBe(true);

      // Record success outcome
      decisionEngine.recordOutcome(metricId, "success");
    }

    // Verify action was logged
    const actions = actionLogger.listActions("test-project");
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].outcome).toBe("success");
  });

  it("should record failure outcome when action fails", async () => {
    // Mock MCP client to reject
    mockMcpClient.sendHeartbeat.mockRejectedValue(
      new Error("Connection failed")
    );

    const event: DetectionEvent = {
      type: "stuck",
      agentId: "agent-1",
      sandboxId: "sandbox-1",
      timestamp: new Date(),
      silentDurationMs: 300000,
    };

    const { decision, metricId } = decisionEngine.processEvent(event);

    if (decision.action === "autonomous") {
      const action: AutonomousAction = {
        type: decision.actionType,
        agentId: event.agentId,
        message: "Agent appears stuck, attempting recovery",
      } as AutonomousAction;

      const result = await actionExecutor.execute(action, event);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Record failure outcome
      decisionEngine.recordOutcome(metricId, "failure", result.error);
    }

    // Verify failure was logged
    const actions = actionLogger.listActions("test-project", {
      outcome: "failure",
    });
    expect(actions.length).toBe(1);
    expect(actions[0].outcomeDetails).toContain("Connection failed");
  });

  it("should emit action events for metrics tracking", async () => {
    const actionListener = vi.fn();
    actionExecutor.on("action", actionListener);

    const event: DetectionEvent = {
      type: "error",
      agentId: "agent-1",
      sandboxId: "sandbox-1",
      timestamp: new Date(),
      message: "Connection refused",
      severity: "warning",
    };

    const { decision, metricId } = decisionEngine.processEvent(event);

    if (decision.action === "autonomous") {
      const action: AutonomousAction = {
        type: decision.actionType,
        agentId: event.agentId,
        message: "Error detected, prompting agent for input",
      } as AutonomousAction;

      await actionExecutor.execute(action, event);
      expect(actionListener).toHaveBeenCalled();
      expect(actionListener).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          success: true,
        })
      );

      decisionEngine.recordOutcome(metricId, "success");
    }
  });

  it('should handle full pipeline: stuck -> prompt -> retry -> success', async () => {
    // First stuck event - should prompt
    const stuckEvent1: DetectionEvent = {
      type: 'stuck',
      agentId: 'agent-1',
      sandboxId: 'sandbox-1',
      timestamp: new Date(),
      silentDurationMs: 300000,
    } as DetectionEvent;

    const result1 = decisionEngine.processEvent(stuckEvent1);
    if (result1.decision.action === 'autonomous' && result1.action) {
      expect(result1.action.type).toBe('prompt_agent');
      const execResult = await actionExecutor.execute(result1.action, stuckEvent1);
      decisionEngine.recordOutcome(result1.metricId!, execResult.success ? 'success' : 'failure');
    }

    // Second stuck event - should prompt again (first attempt)
    const stuckEvent2: DetectionEvent = {
      type: 'stuck',
      agentId: 'agent-1',
      sandboxId: 'sandbox-1',
      timestamp: new Date(),
      silentDurationMs: 300000,
    } as DetectionEvent;

    const result2 = decisionEngine.processEvent(stuckEvent2);
    expect(result2.decision.action).toBe('autonomous');
  });

  it("should track multiple actions and outcomes", async () => {
    const events: DetectionEvent[] = [
      {
        type: "error",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        message: "Error 1",
        severity: "warning",
      },
      {
        type: "error",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        message: "Error 2",
        severity: "warning",
      },
      {
        type: "stuck",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        silentDurationMs: 300000,
      },
    ];

    let successCount = 0;
    for (const event of events) {
      const { decision, metricId } = decisionEngine.processEvent(event);

      if (decision.action === "autonomous") {
        const action: AutonomousAction = {
          type: decision.actionType,
          agentId: event.agentId,
          message: "Action for event",
        } as AutonomousAction;

        const result = await actionExecutor.execute(action, event);
        if (result.success) {
          successCount++;
          decisionEngine.recordOutcome(metricId, "success");
        }
      }
    }

    // Verify all actions were logged
    const allActions = actionLogger.listActions("test-project");
    expect(allActions.length).toBe(events.length);

    // Verify at least some succeeded
    const successfulActions = actionLogger.listActions("test-project", {
      outcome: "success",
    });
    expect(successfulActions.length).toBe(successCount);
  });

  it("should handle action for specific agent", async () => {
    const event: DetectionEvent = {
      type: "error",
      agentId: "specific-agent",
      sandboxId: "sandbox-1",
      timestamp: new Date(),
      message: "Specific agent error",
      severity: "warning",
    };

    const { decision, metricId } = decisionEngine.processEvent(event);

    if (decision.action === "autonomous") {
      const action: AutonomousAction = {
        type: decision.actionType,
        agentId: event.agentId,
        message: "Action for specific agent",
      } as AutonomousAction;

      await actionExecutor.execute(action, event);
      decisionEngine.recordOutcome(metricId, "success");
    }

    // Verify we can retrieve actions by agent
    const agentActions = actionLogger.getActionsByAgent(
      "test-project",
      "specific-agent"
    );
    expect(agentActions.length).toBeGreaterThan(0);
    expect(agentActions[0].triggerEvent.agentId).toBe("specific-agent");
  });
});
