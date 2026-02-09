import { describe, it, expect } from "vitest";
import {
  TaskQuerySchema,
  AccessRequestStatusSchema,
  AccessRequestActionSchema,
  ActionBodySchema,
  SecretCreateSchema,
  OnboardingActionSchema,
  ZoneConfigUpdateSchema,
  SandboxCreateSchema,
  SandboxExecSchema,
  validateBody,
} from "./api-validation";

describe("TaskQuerySchema", () => {
  it("accepts valid query params", () => {
    expect(
      TaskQuerySchema.safeParse({ status: "pending", priority: "high" }).success,
    ).toBe(true);
  });

  it("accepts empty object", () => {
    expect(TaskQuerySchema.safeParse({}).success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(
      TaskQuerySchema.safeParse({ status: "invalid" }).success,
    ).toBe(false);
  });

  it("rejects invalid priority", () => {
    expect(
      TaskQuerySchema.safeParse({ priority: "ultra" }).success,
    ).toBe(false);
  });
});

describe("AccessRequestStatusSchema", () => {
  it("accepts valid statuses", () => {
    expect(AccessRequestStatusSchema.safeParse("pending").success).toBe(true);
    expect(AccessRequestStatusSchema.safeParse("approved").success).toBe(true);
    expect(AccessRequestStatusSchema.safeParse(undefined).success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(AccessRequestStatusSchema.safeParse("unknown").success).toBe(false);
  });
});

describe("AccessRequestActionSchema", () => {
  it("accepts approve action", () => {
    const result = AccessRequestActionSchema.safeParse({
      action: "approve",
      requestId: "req-1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts deny action with reason", () => {
    const result = AccessRequestActionSchema.safeParse({
      action: "deny",
      requestId: "req-1",
      reason: "Not authorized",
    });
    expect(result.success).toBe(true);
  });

  it("accepts expire_old action", () => {
    const result = AccessRequestActionSchema.safeParse({
      action: "expire_old",
      olderThanHours: 48,
    });
    expect(result.success).toBe(true);
  });

  it("rejects approve without requestId", () => {
    const result = AccessRequestActionSchema.safeParse({
      action: "approve",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown action", () => {
    const result = AccessRequestActionSchema.safeParse({
      action: "delete",
      requestId: "req-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("ActionBodySchema", () => {
  it("accepts resolve_conflict", () => {
    const result = ActionBodySchema.safeParse({
      actionType: "resolve_conflict",
      actionId: "conflict-1",
      resolution: "merge",
    });
    expect(result.success).toBe(true);
  });

  it("accepts force_release_lock", () => {
    const result = ActionBodySchema.safeParse({
      actionType: "force_release_lock",
      data: { filePath: "/src/main.ts", agentId: "claude-1" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts pause_agent", () => {
    const result = ActionBodySchema.safeParse({
      actionType: "pause_agent",
      data: { agentId: "claude-1" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts reassign_task", () => {
    const result = ActionBodySchema.safeParse({
      actionType: "reassign_task",
      actionId: "task-1",
      data: { newAgentId: "claude-2" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown actionType", () => {
    const result = ActionBodySchema.safeParse({
      actionType: "nuke_everything",
      actionId: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects resolve_conflict with invalid resolution", () => {
    const result = ActionBodySchema.safeParse({
      actionType: "resolve_conflict",
      actionId: "conflict-1",
      resolution: "yolo",
    });
    expect(result.success).toBe(false);
  });
});

describe("SecretCreateSchema", () => {
  it("accepts valid secret", () => {
    const result = SecretCreateSchema.safeParse({
      name: "ANTHROPIC_API_KEY",
      value: "sk-ant-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects disallowed secret name", () => {
    const result = SecretCreateSchema.safeParse({
      name: "MY_CUSTOM_SECRET",
      value: "something",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty value", () => {
    const result = SecretCreateSchema.safeParse({
      name: "E2B_API_KEY",
      value: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects value exceeding 10KB", () => {
    const result = SecretCreateSchema.safeParse({
      name: "E2B_API_KEY",
      value: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });
});

describe("OnboardingActionSchema", () => {
  it("accepts valid save action", () => {
    const result = OnboardingActionSchema.safeParse({
      action: "save",
      welcomeMessage: "Hello",
      goals: ["Ship MVP"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-save action", () => {
    const result = OnboardingActionSchema.safeParse({
      action: "delete",
    });
    expect(result.success).toBe(false);
  });

  it("rejects goals exceeding limit", () => {
    const result = OnboardingActionSchema.safeParse({
      action: "save",
      goals: Array(51).fill("goal"),
    });
    expect(result.success).toBe(false);
  });
});

describe("ZoneConfigUpdateSchema", () => {
  it("accepts valid config", () => {
    const result = ZoneConfigUpdateSchema.safeParse({
      config: { zones: [{ name: "frontend", paths: ["src/"] }] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing config", () => {
    const result = ZoneConfigUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("SandboxCreateSchema", () => {
  it("accepts valid sandbox creation", () => {
    const result = SandboxCreateSchema.safeParse({
      agentId: "claude-1",
      type: "claude-code",
      timeout: 300,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing agentId", () => {
    const result = SandboxCreateSchema.safeParse({
      type: "claude-code",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid agent type", () => {
    const result = SandboxCreateSchema.safeParse({
      agentId: "x",
      type: "gpt-turbo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects timeout exceeding 24h", () => {
    const result = SandboxCreateSchema.safeParse({
      agentId: "x",
      timeout: 100000,
    });
    expect(result.success).toBe(false);
  });
});

describe("SandboxExecSchema", () => {
  it("accepts valid exec with sandboxId", () => {
    const result = SandboxExecSchema.safeParse({
      sandboxId: "sb-123",
      command: "ls -la",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid exec with agentId", () => {
    const result = SandboxExecSchema.safeParse({
      agentId: "claude-1",
      command: "npm test",
    });
    expect(result.success).toBe(true);
  });

  it("rejects exec without sandboxId or agentId", () => {
    const result = SandboxExecSchema.safeParse({
      command: "ls",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty command", () => {
    const result = SandboxExecSchema.safeParse({
      sandboxId: "sb-1",
      command: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("validateBody helper", () => {
  it("returns parsed data on success", () => {
    const result = validateBody(SecretCreateSchema, {
      name: "E2B_API_KEY",
      value: "key-123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("E2B_API_KEY");
    }
  });

  it("returns error details on failure", () => {
    const result = validateBody(SecretCreateSchema, {
      name: "INVALID",
      value: 123,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.error).toBe("Validation failed");
      expect(result.error.details).toBeDefined();
    }
  });
});
