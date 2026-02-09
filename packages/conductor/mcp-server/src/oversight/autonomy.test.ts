import { describe, it, expect } from "vitest";
import {
  canExecuteAction,
  requiresApproval,
  isCriticalAction,
  isRoutineAction,
  getAutonomyLevel,
  createDecision,
  getAutonomyDescription,
  recommendAutonomyLevel,
  type AutonomyLevel,
} from "./autonomy";

describe("Autonomy System", () => {
  describe("canExecuteAction", () => {
    it("should allow all routine actions in full_auto", () => {
      const config = { level: "full_auto" as AutonomyLevel };
      expect(canExecuteAction(config, "reassign_task")).toBe(true);
      expect(canExecuteAction(config, "restart_agent")).toBe(true);
      expect(canExecuteAction(config, "cleanup_locks")).toBe(true);
    });

    it("should block critical actions in full_auto", () => {
      const config = { level: "full_auto" as AutonomyLevel };
      expect(canExecuteAction(config, "delete_project")).toBe(false);
      expect(canExecuteAction(config, "revoke_agent_access")).toBe(false);
    });

    it("should allow only routine actions in supervised", () => {
      const config = { level: "supervised" as AutonomyLevel };
      expect(canExecuteAction(config, "reassign_task")).toBe(true);
      expect(canExecuteAction(config, "restart_agent")).toBe(true);
      expect(canExecuteAction(config, "delete_project")).toBe(false);
    });

    it("should block all actions in assisted mode", () => {
      const config = { level: "assisted" as AutonomyLevel };
      expect(canExecuteAction(config, "reassign_task")).toBe(false);
      expect(canExecuteAction(config, "restart_agent")).toBe(false);
      expect(canExecuteAction(config, "delete_project")).toBe(false);
    });

    it("should block all actions in manual mode", () => {
      const config = { level: "manual" as AutonomyLevel };
      expect(canExecuteAction(config, "reassign_task")).toBe(false);
      expect(canExecuteAction(config, "restart_agent")).toBe(false);
    });

    it("should respect explicit allow list", () => {
      const config = {
        level: "manual" as AutonomyLevel,
        allowedActions: ["restart_agent"],
      };
      expect(canExecuteAction(config, "restart_agent")).toBe(true);
      expect(canExecuteAction(config, "reassign_task")).toBe(false);
    });

    it("should respect explicit deny list", () => {
      const config = {
        level: "full_auto" as AutonomyLevel,
        deniedActions: ["restart_agent"],
      };
      expect(canExecuteAction(config, "restart_agent")).toBe(false);
      expect(canExecuteAction(config, "reassign_task")).toBe(true);
    });
  });

  describe("requiresApproval", () => {
    it("should require approval for critical actions in full_auto", () => {
      const config = { level: "full_auto" as AutonomyLevel };
      expect(requiresApproval(config, "delete_project")).toBe(true);
      expect(requiresApproval(config, "reassign_task")).toBe(false);
    });

    it("should require approval for critical actions in supervised", () => {
      const config = { level: "supervised" as AutonomyLevel };
      expect(requiresApproval(config, "delete_project")).toBe(true);
      expect(requiresApproval(config, "restart_agent")).toBe(false);
    });

    it("should require approval for all actions in assisted", () => {
      const config = { level: "assisted" as AutonomyLevel };
      expect(requiresApproval(config, "reassign_task")).toBe(true);
      expect(requiresApproval(config, "restart_agent")).toBe(true);
    });

    it("should require approval for all actions in manual", () => {
      const config = { level: "manual" as AutonomyLevel };
      expect(requiresApproval(config, "reassign_task")).toBe(true);
      expect(requiresApproval(config, "restart_agent")).toBe(true);
    });
  });

  describe("Action Classification", () => {
    it("should identify critical actions", () => {
      expect(isCriticalAction("delete_project")).toBe(true);
      expect(isCriticalAction("delete_organization")).toBe(true);
      expect(isCriticalAction("revoke_agent_access")).toBe(true);
      expect(isCriticalAction("force_push")).toBe(true);
      expect(isCriticalAction("reassign_task")).toBe(false);
    });

    it("should identify routine actions", () => {
      expect(isRoutineAction("reassign_task")).toBe(true);
      expect(isRoutineAction("restart_agent")).toBe(true);
      expect(isRoutineAction("cleanup_locks")).toBe(true);
      expect(isRoutineAction("delete_project")).toBe(false);
    });
  });

  describe("getAutonomyLevel", () => {
    it("should extract autonomy level from project settings", () => {
      const settings = { autonomy_level: "full_auto" };
      expect(getAutonomyLevel(settings)).toBe("full_auto");
    });

    it("should default to supervised when not set", () => {
      const settings = {};
      expect(getAutonomyLevel(settings)).toBe("supervised");
    });
  });

  describe("createDecision", () => {
    it("should create decision with correct status for routine action", () => {
      const decision = createDecision(
        "reassign_task",
        "Task stuck for 10 minutes",
        "full_auto",
      );

      expect(decision.type).toBe("reassign_task");
      expect(decision.reason).toBe("Task stuck for 10 minutes");
      expect(decision.autonomyLevel).toBe("full_auto");
      expect(decision.status).toBe("approved"); // Routine action in full_auto
      expect(decision.id).toBeDefined();
      expect(decision.createdAt).toBeInstanceOf(Date);
    });

    it("should create decision with pending status for critical action", () => {
      const decision = createDecision(
        "delete_project",
        "Project inactive for 90 days",
        "full_auto",
      );

      expect(decision.type).toBe("delete_project");
      expect(decision.status).toBe("pending"); // Critical action needs approval
    });

    it("should include metadata in decision", () => {
      const decision = createDecision(
        "restart_agent",
        "Agent crashed",
        "supervised",
        { agentId: "agent-123", errorCode: "OOM" },
      );

      expect(decision.metadata).toEqual({
        agentId: "agent-123",
        errorCode: "OOM",
      });
    });
  });

  describe("getAutonomyDescription", () => {
    it("should return correct descriptions for each level", () => {
      expect(getAutonomyDescription("full_auto")).toContain("routine decisions automatically");
      expect(getAutonomyDescription("supervised")).toContain("logs for review");
      expect(getAutonomyDescription("assisted")).toContain("recommends actions");
      expect(getAutonomyDescription("manual")).toContain("monitors only");
    });
  });

  describe("recommendAutonomyLevel", () => {
    it("should recommend assisted for production projects", () => {
      const project = { isProduction: true };
      expect(recommendAutonomyLevel(project)).toBe("assisted");
    });

    it("should recommend assisted for high-budget projects", () => {
      const project = { budget: { total: 5000 } };
      expect(recommendAutonomyLevel(project)).toBe("assisted");
    });

    it("should recommend supervised for merge strategy", () => {
      const project = { conflictStrategy: "merge" };
      expect(recommendAutonomyLevel(project)).toBe("supervised");
    });

    it("should recommend supervised for conservative strategies", () => {
      const project = { conflictStrategy: "lock" };
      expect(recommendAutonomyLevel(project)).toBe("supervised");
    });

    it("should default to supervised for normal projects", () => {
      const project = {};
      expect(recommendAutonomyLevel(project)).toBe("supervised");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty config gracefully", () => {
      const config = { level: "manual" as AutonomyLevel };
      expect(canExecuteAction(config, "any_action")).toBe(false);
    });

    it("should prioritize deny list over allow list", () => {
      const config = {
        level: "full_auto" as AutonomyLevel,
        allowedActions: ["restart_agent"],
        deniedActions: ["restart_agent"],
      };
      expect(canExecuteAction(config, "restart_agent")).toBe(false);
    });

    it("should handle unknown action types conservatively", () => {
      const config = { level: "full_auto" as AutonomyLevel };
      // Unknown actions default to non-critical, but not routine
      expect(canExecuteAction(config, "unknown_action")).toBe(true);
      expect(requiresApproval(config, "unknown_action")).toBe(false);
    });
  });
});
