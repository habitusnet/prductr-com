import { describe, it, expect, beforeEach, vi } from "vitest";
import { DecisionEngine } from "./decision-engine";
import type { PatternMatch } from "./decision-engine";
import type { AutonomyConfig } from "./autonomy";

describe("DecisionEngine", () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine();
  });

  describe("processPattern", () => {
    it("should execute routine action in full_auto mode", async () => {
      const pattern: PatternMatch = {
        type: "stuck",
        severity: "medium",
        confidence: 0.9,
        context: {
          taskId: "task-123",
          agentId: "agent-456",
          projectId: "proj-789",
        },
        suggestedAction: "reassign_task",
        reason: "Task stuck for 10 minutes",
      };

      const config: AutonomyConfig = { level: "full_auto" };

      const result = await engine.processPattern(pattern, config);

      expect(result.success).toBe(true);
      expect(result.executed).toBe(true);
      expect(result.decision.status).toBe("executed");
      expect(result.decision.type).toBe("reassign_task");
    });

    it("should not execute but log in supervised mode for routine action", async () => {
      const pattern: PatternMatch = {
        type: "stuck",
        severity: "medium",
        confidence: 0.9,
        context: { taskId: "task-123" },
        suggestedAction: "reassign_task",
        reason: "Task stuck",
      };

      const config: AutonomyConfig = { level: "supervised" };

      const result = await engine.processPattern(pattern, config);

      expect(result.success).toBe(true);
      expect(result.executed).toBe(true);
      expect(result.decision.status).toBe("executed");
    });

    it("should require approval in assisted mode", async () => {
      const pattern: PatternMatch = {
        type: "stuck",
        severity: "medium",
        confidence: 0.9,
        context: { taskId: "task-123" },
        suggestedAction: "reassign_task",
        reason: "Task stuck",
      };

      const config: AutonomyConfig = { level: "assisted" };

      const result = await engine.processPattern(pattern, config);

      expect(result.success).toBe(false);
      expect(result.executed).toBe(false);
      expect(result.decision.status).toBe("pending");
    });

    it("should require approval in manual mode", async () => {
      const pattern: PatternMatch = {
        type: "stuck",
        severity: "low",
        confidence: 0.8,
        context: { taskId: "task-123" },
        suggestedAction: "reassign_task",
        reason: "Task stuck",
      };

      const config: AutonomyConfig = { level: "manual" };

      const result = await engine.processPattern(pattern, config);

      expect(result.success).toBe(false);
      expect(result.executed).toBe(false);
      expect(result.decision.status).toBe("pending");
    });

    it("should require approval for critical actions even in full_auto", async () => {
      const pattern: PatternMatch = {
        type: "security_violation",
        severity: "critical",
        confidence: 0.95,
        context: { projectId: "proj-789" },
        suggestedAction: "revoke_agent_access",
        reason: "Security policy violation detected",
      };

      const config: AutonomyConfig = { level: "full_auto" };

      const result = await engine.processPattern(pattern, config);

      expect(result.success).toBe(false);
      expect(result.executed).toBe(false);
      expect(result.decision.status).toBe("pending");
    });

    it("should include pattern metadata in decision", async () => {
      const pattern: PatternMatch = {
        type: "error",
        severity: "high",
        confidence: 0.85,
        context: {
          taskId: "task-123",
          errorCode: "TIMEOUT",
        },
        suggestedAction: "retry_task",
        reason: "Task timed out",
      };

      const config: AutonomyConfig = { level: "full_auto" };

      const result = await engine.processPattern(pattern, config);

      expect(result.decision.metadata).toEqual({
        pattern: "error",
        severity: "high",
        confidence: 0.85,
        context: {
          taskId: "task-123",
          errorCode: "TIMEOUT",
        },
      });
    });
  });

  describe("approveDecision", () => {
    it("should execute decision after approval", async () => {
      // Create pending decision
      const pattern: PatternMatch = {
        type: "stuck",
        severity: "medium",
        confidence: 0.9,
        context: { taskId: "task-123" },
        suggestedAction: "reassign_task",
        reason: "Task stuck",
      };

      const config: AutonomyConfig = { level: "assisted" };
      const result = await engine.processPattern(pattern, config);

      expect(result.decision.status).toBe("pending");

      // Approve and execute
      await engine.approveDecision(result.decision.id, "user-admin");

      const decisions = engine.getDecisions();
      const decision = decisions.find((d) => d.id === result.decision.id);

      expect(decision?.status).toBe("executed");
      expect(decision?.approvedBy).toBe("user-admin");
      expect(decision?.executedAt).toBeInstanceOf(Date);
    });

    it("should throw error if decision not found", async () => {
      await expect(
        engine.approveDecision("nonexistent-id", "user-admin"),
      ).rejects.toThrow("Decision nonexistent-id not found");
    });

    it("should throw error if decision not pending", async () => {
      const pattern: PatternMatch = {
        type: "stuck",
        severity: "medium",
        confidence: 0.9,
        context: { taskId: "task-123" },
        suggestedAction: "reassign_task",
        reason: "Task stuck",
      };

      const config: AutonomyConfig = { level: "full_auto" };
      const result = await engine.processPattern(pattern, config);

      // Already executed, cannot approve
      await expect(
        engine.approveDecision(result.decision.id, "user-admin"),
      ).rejects.toThrow("is not pending");
    });
  });

  describe("rejectDecision", () => {
    it("should mark decision as rejected", async () => {
      const pattern: PatternMatch = {
        type: "stuck",
        severity: "medium",
        confidence: 0.9,
        context: { taskId: "task-123" },
        suggestedAction: "reassign_task",
        reason: "Task stuck",
      };

      const config: AutonomyConfig = { level: "assisted" };
      const result = await engine.processPattern(pattern, config);

      engine.rejectDecision(result.decision.id, "Not a real issue");

      const decisions = engine.getDecisions();
      const decision = decisions.find((d) => d.id === result.decision.id);

      expect(decision?.status).toBe("rejected");
      expect(decision?.result).toBe("Not a real issue");
      expect(decision?.decidedAt).toBeInstanceOf(Date);
    });
  });

  describe("getDecisions", () => {
    it("should filter decisions by status", async () => {
      // Create multiple decisions with different statuses
      const pattern1: PatternMatch = {
        type: "stuck",
        severity: "medium",
        confidence: 0.9,
        context: { taskId: "task-1" },
        suggestedAction: "reassign_task",
        reason: "Task stuck",
      };

      const pattern2: PatternMatch = {
        type: "error",
        severity: "high",
        confidence: 0.85,
        context: { taskId: "task-2" },
        suggestedAction: "retry_task",
        reason: "Task error",
      };

      await engine.processPattern(pattern1, { level: "full_auto" });
      await engine.processPattern(pattern2, { level: "assisted" });

      const executedDecisions = engine.getDecisions({ status: "executed" });
      const pendingDecisions = engine.getDecisions({ status: "pending" });

      expect(executedDecisions.length).toBe(1);
      expect(executedDecisions[0].type).toBe("reassign_task");

      expect(pendingDecisions.length).toBe(1);
      expect(pendingDecisions[0].type).toBe("retry_task");
    });

    it("should filter decisions by projectId", async () => {
      const pattern1: PatternMatch = {
        type: "stuck",
        severity: "medium",
        confidence: 0.9,
        context: { taskId: "task-1", projectId: "proj-A" },
        suggestedAction: "reassign_task",
        reason: "Task stuck",
      };

      const pattern2: PatternMatch = {
        type: "error",
        severity: "high",
        confidence: 0.85,
        context: { taskId: "task-2", projectId: "proj-B" },
        suggestedAction: "retry_task",
        reason: "Task error",
      };

      await engine.processPattern(pattern1, { level: "full_auto" });
      await engine.processPattern(pattern2, { level: "full_auto" });

      const projADecisions = engine.getDecisions({ projectId: "proj-A" });
      const projBDecisions = engine.getDecisions({ projectId: "proj-B" });

      expect(projADecisions.length).toBe(1);
      expect(projADecisions[0].projectId).toBe("proj-A");

      expect(projBDecisions.length).toBe(1);
      expect(projBDecisions[0].projectId).toBe("proj-B");
    });

    it("should filter decisions by agentId", async () => {
      const pattern1: PatternMatch = {
        type: "crash",
        severity: "high",
        confidence: 0.9,
        context: { agentId: "agent-1", projectId: "proj-A" },
        suggestedAction: "restart_agent",
        reason: "Agent crashed",
      };

      const pattern2: PatternMatch = {
        type: "crash",
        severity: "high",
        confidence: 0.95,
        context: { agentId: "agent-2", projectId: "proj-A" },
        suggestedAction: "restart_agent",
        reason: "Agent crashed",
      };

      await engine.processPattern(pattern1, { level: "supervised" });
      await engine.processPattern(pattern2, { level: "supervised" });

      const agent1Decisions = engine.getDecisions({ agentId: "agent-1" });
      const agent2Decisions = engine.getDecisions({ agentId: "agent-2" });

      expect(agent1Decisions.length).toBe(1);
      expect(agent1Decisions[0].agentId).toBe("agent-1");

      expect(agent2Decisions.length).toBe(1);
      expect(agent2Decisions[0].agentId).toBe("agent-2");
    });
  });

  describe("getPendingDecisions", () => {
    it("should return only pending decisions", async () => {
      const pattern1: PatternMatch = {
        type: "stuck",
        severity: "medium",
        confidence: 0.9,
        context: { taskId: "task-1", projectId: "proj-A" },
        suggestedAction: "reassign_task",
        reason: "Task stuck",
      };

      const pattern2: PatternMatch = {
        type: "error",
        severity: "high",
        confidence: 0.85,
        context: { taskId: "task-2", projectId: "proj-A" },
        suggestedAction: "retry_task",
        reason: "Task error",
      };

      await engine.processPattern(pattern1, { level: "full_auto" }); // Executed
      await engine.processPattern(pattern2, { level: "assisted" }); // Pending

      const pending = engine.getPendingDecisions();

      expect(pending.length).toBe(1);
      expect(pending[0].type).toBe("retry_task");
      expect(pending[0].status).toBe("pending");
    });

    it("should filter pending decisions by projectId", async () => {
      const pattern1: PatternMatch = {
        type: "stuck",
        severity: "medium",
        confidence: 0.9,
        context: { taskId: "task-1", projectId: "proj-A" },
        suggestedAction: "reassign_task",
        reason: "Task stuck",
      };

      const pattern2: PatternMatch = {
        type: "error",
        severity: "high",
        confidence: 0.85,
        context: { taskId: "task-2", projectId: "proj-B" },
        suggestedAction: "retry_task",
        reason: "Task error",
      };

      await engine.processPattern(pattern1, { level: "assisted" });
      await engine.processPattern(pattern2, { level: "assisted" });

      const projAPending = engine.getPendingDecisions("proj-A");
      const projBPending = engine.getPendingDecisions("proj-B");

      expect(projAPending.length).toBe(1);
      expect(projAPending[0].projectId).toBe("proj-A");

      expect(projBPending.length).toBe(1);
      expect(projBPending[0].projectId).toBe("proj-B");
    });
  });

  describe("clearOldDecisions", () => {
    it("should remove decisions older than specified date", async () => {
      const pattern: PatternMatch = {
        type: "stuck",
        severity: "medium",
        confidence: 0.9,
        context: { taskId: "task-123" },
        suggestedAction: "reassign_task",
        reason: "Task stuck",
      };

      await engine.processPattern(pattern, { level: "full_auto" });

      expect(engine.getDecisions().length).toBe(1);

      // Clear decisions older than 1 hour from now (should keep all current)
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      engine.clearOldDecisions(oneHourFromNow);

      expect(engine.getDecisions().length).toBe(0);
    });
  });
});
