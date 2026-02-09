import { describe, it, expect, beforeEach } from "vitest";
import {
  createEscalation,
  getPriorityForType,
  shouldNotify,
  getPriorityColor,
  getTypeIcon,
  getTypeDescription,
  sortEscalations,
  isDue,
  getDueEscalations,
  EscalationQueue,
  type Escalation,
} from "./escalation";

describe("Escalation System", () => {
  describe("getPriorityForType", () => {
    it("should assign critical priority to oauth_required", () => {
      expect(getPriorityForType("oauth_required")).toBe("critical");
    });

    it("should assign high priority to merge_conflict", () => {
      expect(getPriorityForType("merge_conflict")).toBe("high");
    });

    it("should assign high priority to budget_exceeded", () => {
      expect(getPriorityForType("budget_exceeded")).toBe("high");
    });

    it("should assign normal priority to task_review", () => {
      expect(getPriorityForType("task_review")).toBe("normal");
    });

    it("should assign normal priority to agent_error", () => {
      expect(getPriorityForType("agent_error")).toBe("normal");
    });
  });

  describe("createEscalation", () => {
    it("should create escalation with auto-assigned priority", () => {
      const escalation = createEscalation({
        projectId: "proj-123",
        type: "oauth_required",
        title: "Agent needs re-auth",
        description: "OAuth token expired",
        context: { agentId: "agent-456" },
      });

      expect(escalation.id).toBeDefined();
      expect(escalation.type).toBe("oauth_required");
      expect(escalation.priority).toBe("critical");
      expect(escalation.status).toBe("pending");
      expect(escalation.title).toBe("Agent needs re-auth");
      expect(escalation.context).toEqual({ agentId: "agent-456" });
    });

    it("should create escalation with assigned user", () => {
      const escalation = createEscalation({
        projectId: "proj-123",
        type: "task_review",
        title: "Review completed task",
        assignedTo: "user-789",
      });

      expect(escalation.assignedTo).toBe("user-789");
    });
  });

  describe("shouldNotify", () => {
    it("should notify for critical priority", () => {
      const escalation: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "oauth_required",
        priority: "critical",
        status: "pending",
        title: "OAuth required",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(shouldNotify(escalation)).toBe(true);
    });

    it("should notify for high priority with assignment", () => {
      const escalation: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "merge_conflict",
        priority: "high",
        status: "pending",
        title: "Merge conflict",
        context: {},
        assignedTo: "user-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(shouldNotify(escalation)).toBe(true);
    });

    it("should not notify for high priority without assignment", () => {
      const escalation: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "merge_conflict",
        priority: "high",
        status: "pending",
        title: "Merge conflict",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(shouldNotify(escalation)).toBe(false);
    });

    it("should not notify for normal priority", () => {
      const escalation: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "task_review",
        priority: "normal",
        status: "pending",
        title: "Review task",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(shouldNotify(escalation)).toBe(false);
    });
  });

  describe("Display Helpers", () => {
    it("should return correct colors for priorities", () => {
      expect(getPriorityColor("critical")).toBe("red");
      expect(getPriorityColor("high")).toBe("orange");
      expect(getPriorityColor("normal")).toBe("blue");
      expect(getPriorityColor("low")).toBe("gray");
    });

    it("should return correct icons for types", () => {
      expect(getTypeIcon("oauth_required")).toBe("🔐");
      expect(getTypeIcon("merge_conflict")).toBe("⚠️");
      expect(getTypeIcon("task_review")).toBe("📋");
      expect(getTypeIcon("agent_error")).toBe("🔴");
      expect(getTypeIcon("budget_exceeded")).toBe("💰");
      expect(getTypeIcon("manual_intervention")).toBe("✋");
    });

    it("should return descriptions for types", () => {
      expect(getTypeDescription("oauth_required")).toContain("re-authentication");
      expect(getTypeDescription("merge_conflict")).toContain("merge conflict");
      expect(getTypeDescription("task_review")).toContain("review");
      expect(getTypeDescription("agent_error")).toContain("error");
      expect(getTypeDescription("budget_exceeded")).toContain("budget");
      expect(getTypeDescription("manual_intervention")).toContain("intervention");
    });
  });

  describe("sortEscalations", () => {
    it("should sort by priority first (critical > high > normal)", () => {
      const escalations: Escalation[] = [
        {
          id: "esc-1",
          projectId: "proj-1",
          type: "task_review",
          priority: "normal",
          status: "pending",
          title: "Normal",
          context: {},
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date(),
        },
        {
          id: "esc-2",
          projectId: "proj-1",
          type: "oauth_required",
          priority: "critical",
          status: "pending",
          title: "Critical",
          context: {},
          createdAt: new Date("2024-01-03"),
          updatedAt: new Date(),
        },
        {
          id: "esc-3",
          projectId: "proj-1",
          type: "merge_conflict",
          priority: "high",
          status: "pending",
          title: "High",
          context: {},
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date(),
        },
      ];

      const sorted = sortEscalations(escalations);

      expect(sorted[0].priority).toBe("critical");
      expect(sorted[1].priority).toBe("high");
      expect(sorted[2].priority).toBe("normal");
    });

    it("should sort by age within same priority (oldest first)", () => {
      const escalations: Escalation[] = [
        {
          id: "esc-1",
          projectId: "proj-1",
          type: "task_review",
          priority: "normal",
          status: "pending",
          title: "Newer",
          context: {},
          createdAt: new Date("2024-01-03"),
          updatedAt: new Date(),
        },
        {
          id: "esc-2",
          projectId: "proj-1",
          type: "task_review",
          priority: "normal",
          status: "pending",
          title: "Older",
          context: {},
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date(),
        },
      ];

      const sorted = sortEscalations(escalations);

      expect(sorted[0].title).toBe("Older");
      expect(sorted[1].title).toBe("Newer");
    });
  });

  describe("isDue", () => {
    it("should return true for pending escalations", () => {
      const escalation: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "task_review",
        priority: "normal",
        status: "pending",
        title: "Pending",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isDue(escalation)).toBe(true);
    });

    it("should return false for snoozed escalations before snooze time", () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const escalation: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "task_review",
        priority: "normal",
        status: "snoozed",
        title: "Snoozed",
        context: {},
        snoozedUntil: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isDue(escalation)).toBe(false);
    });

    it("should return true for snoozed escalations after snooze time", () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const escalation: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "task_review",
        priority: "normal",
        status: "snoozed",
        title: "Snoozed",
        context: {},
        snoozedUntil: pastDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isDue(escalation)).toBe(true);
    });
  });

  describe("getDueEscalations", () => {
    it("should return only pending and due escalations", () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      const escalations: Escalation[] = [
        {
          id: "esc-1",
          projectId: "proj-1",
          type: "task_review",
          priority: "normal",
          status: "pending",
          title: "Pending",
          context: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "esc-2",
          projectId: "proj-1",
          type: "task_review",
          priority: "normal",
          status: "snoozed",
          title: "Snoozed",
          context: {},
          snoozedUntil: futureDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "esc-3",
          projectId: "proj-1",
          type: "task_review",
          priority: "normal",
          status: "resolved",
          title: "Resolved",
          context: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const due = getDueEscalations(escalations);

      expect(due.length).toBe(1);
      expect(due[0].title).toBe("Pending");
    });
  });

  describe("EscalationQueue", () => {
    let queue: EscalationQueue;

    beforeEach(() => {
      queue = new EscalationQueue();
    });

    it("should add and retrieve escalations", () => {
      const escalation: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "task_review",
        priority: "normal",
        status: "pending",
        title: "Review task",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queue.add(escalation);

      const retrieved = queue.get("esc-1");
      expect(retrieved).toEqual(escalation);
    });

    it("should resolve escalations", () => {
      const escalation: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "task_review",
        priority: "normal",
        status: "pending",
        title: "Review task",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queue.add(escalation);
      const resolved = queue.resolve("esc-1", "user-123", "Task approved");

      expect(resolved?.status).toBe("resolved");
      expect(resolved?.resolvedBy).toBe("user-123");
      expect(resolved?.resolution).toBe("Task approved");
      expect(resolved?.resolvedAt).toBeInstanceOf(Date);
    });

    it("should snooze escalations", () => {
      const escalation: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "task_review",
        priority: "normal",
        status: "pending",
        title: "Review task",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queue.add(escalation);
      const snoozeUntil = new Date(Date.now() + 60 * 60 * 1000);
      const snoozed = queue.snooze("esc-1", snoozeUntil);

      expect(snoozed?.status).toBe("snoozed");
      expect(snoozed?.snoozedUntil).toEqual(snoozeUntil);
    });

    it("should escalate to external", () => {
      const escalation: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "merge_conflict",
        priority: "high",
        status: "pending",
        title: "Complex conflict",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queue.add(escalation);
      const escalated = queue.escalateExternal("esc-1", "user-123");

      expect(escalated?.status).toBe("escalated");
      expect(escalated?.resolvedBy).toBe("user-123");
      expect(escalated?.resolvedAt).toBeInstanceOf(Date);
    });

    it("should list escalations with filters", () => {
      const esc1: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "oauth_required",
        priority: "critical",
        status: "pending",
        title: "OAuth",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const esc2: Escalation = {
        id: "esc-2",
        projectId: "proj-1",
        type: "task_review",
        priority: "normal",
        status: "pending",
        title: "Review",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queue.add(esc1);
      queue.add(esc2);

      const critical = queue.list({ priority: "critical" });
      expect(critical.length).toBe(1);
      expect(critical[0].type).toBe("oauth_required");

      const normal = queue.list({ priority: "normal" });
      expect(normal.length).toBe(1);
      expect(normal[0].type).toBe("task_review");
    });

    it("should get pending escalations", () => {
      const esc1: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "task_review",
        priority: "normal",
        status: "pending",
        title: "Pending",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const esc2: Escalation = {
        id: "esc-2",
        projectId: "proj-1",
        type: "task_review",
        priority: "normal",
        status: "resolved",
        title: "Resolved",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queue.add(esc1);
      queue.add(esc2);

      const pending = queue.getPending();
      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe("pending");
    });

    it("should get critical escalations", () => {
      const esc1: Escalation = {
        id: "esc-1",
        projectId: "proj-1",
        type: "oauth_required",
        priority: "critical",
        status: "pending",
        title: "Critical",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const esc2: Escalation = {
        id: "esc-2",
        projectId: "proj-1",
        type: "task_review",
        priority: "normal",
        status: "pending",
        title: "Normal",
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queue.add(esc1);
      queue.add(esc2);

      const critical = queue.getCritical();
      expect(critical.length).toBe(1);
      expect(critical[0].priority).toBe("critical");
    });
  });
});
