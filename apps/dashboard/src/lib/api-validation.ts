/**
 * Zod validation schemas for all dashboard API routes.
 * Centralizes input validation for POST/PUT/DELETE endpoints.
 */

import { z } from "zod";

// ── Task query params ──────────────────────────────────────────────

export const TaskQuerySchema = z.object({
  status: z
    .enum([
      "pending",
      "claimed",
      "in_progress",
      "completed",
      "failed",
      "blocked",
      "cancelled",
    ])
    .optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  assignedTo: z.string().max(256).optional(),
});

// ── Access requests ────────────────────────────────────────────────

export const AccessRequestStatusSchema = z
  .enum(["pending", "approved", "denied", "expired"])
  .optional();

export const AccessRequestActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    requestId: z.string().min(1),
    reviewedBy: z.string().max(256).optional(),
  }),
  z.object({
    action: z.literal("deny"),
    requestId: z.string().min(1),
    reviewedBy: z.string().max(256).optional(),
    reason: z.string().max(1000).optional(),
  }),
  z.object({
    action: z.literal("expire_old"),
    olderThanHours: z.number().int().min(1).max(8760).optional(),
  }),
]);

// ── Actions ────────────────────────────────────────────────────────

export const ActionBodySchema = z.discriminatedUnion("actionType", [
  z.object({
    actionType: z.literal("resolve_conflict"),
    actionId: z.string().min(1),
    resolution: z.enum(["accept_first", "accept_second", "merge", "defer"]),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    actionType: z.literal("force_release_lock"),
    actionId: z.string().optional(),
    resolution: z.string().optional(),
    data: z.object({
      filePath: z.string().min(1),
      agentId: z.string().min(1),
    }),
  }),
  z.object({
    actionType: z.literal("unblock_task"),
    actionId: z.string().min(1),
    resolution: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    actionType: z.literal("cancel_task"),
    actionId: z.string().min(1),
    resolution: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    actionType: z.literal("reassign_task"),
    actionId: z.string().min(1),
    resolution: z.string().optional(),
    data: z.object({
      newAgentId: z.string().min(1),
    }),
  }),
  z.object({
    actionType: z.literal("pause_agent"),
    actionId: z.string().optional(),
    resolution: z.string().optional(),
    data: z.object({
      agentId: z.string().min(1),
    }),
  }),
  z.object({
    actionType: z.literal("resume_agent"),
    actionId: z.string().optional(),
    resolution: z.string().optional(),
    data: z.object({
      agentId: z.string().min(1),
    }),
  }),
  z.object({
    actionType: z.literal("pause_all"),
    actionId: z.string().optional(),
    resolution: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    actionType: z.literal("resume_all"),
    actionId: z.string().optional(),
    resolution: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
]);

// ── Secrets ────────────────────────────────────────────────────────

export const ALLOWED_SECRET_NAMES = [
  "E2B_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "ZAI_API_KEY",
  "GITHUB_TOKEN",
  "CONDUCTOR_DATABASE_URL",
] as const;

export const SecretCreateSchema = z.object({
  name: z.enum(ALLOWED_SECRET_NAMES),
  value: z.string().min(1).max(10000),
  provider: z.string().max(256).optional(),
});

// ── Onboarding ─────────────────────────────────────────────────────

export const OnboardingActionSchema = z.object({
  action: z.literal("save"),
  welcomeMessage: z.string().max(5000).optional(),
  currentFocus: z.string().max(2000).optional(),
  goals: z.array(z.string().max(500)).max(50).optional(),
  styleGuide: z.string().max(10000).optional(),
  checkpointRules: z.array(z.string().max(500)).max(50).optional(),
  checkpointEveryNTasks: z.number().int().min(1).max(100).optional(),
  autoRefreshContext: z.boolean().optional(),
  agentInstructionsFiles: z.record(z.string(), z.string().max(5000)).optional(),
});

// ── Zone config ────────────────────────────────────────────────────

export const ZoneConfigUpdateSchema = z.object({
  config: z.record(z.string(), z.unknown()),
});

// ── Sandboxes ──────────────────────────────────────────────────────

export const SandboxCreateSchema = z.object({
  action: z.enum(["spawn", "create"]).optional(),
  agentId: z.string().min(1).max(256),
  projectId: z.string().max(256).optional(),
  type: z.enum(["claude-code", "aider", "copilot", "crush", "custom"]).optional(),
  template: z.string().max(256).optional(),
  timeout: z.number().int().min(1).max(86400).optional(),
  gitRepo: z.string().max(2048).optional(),
  gitBranch: z.string().max(256).optional(),
  workDir: z.string().max(1024).optional(),
  mcpServerUrl: z.string().max(2048).optional(),
  runImmediately: z.boolean().optional(),
});

export const SandboxExecSchema = z.object({
  sandboxId: z.string().max(256).optional(),
  agentId: z.string().max(256).optional(),
  command: z.string().min(1).max(10000),
  cwd: z.string().max(1024).optional(),
  timeout: z.number().int().min(1).max(3600).optional(),
}).refine((data) => data.sandboxId || data.agentId, {
  message: "Either sandboxId or agentId is required",
});

// ── Helper ─────────────────────────────────────────────────────────

/**
 * Validate input and return a 400 response on failure, or parsed data on success.
 */
export function validateBody<T>(
  schema: z.ZodType<T>,
  data: unknown,
):
  | { success: true; data: T }
  | { success: false; error: { error: string; details: Record<string, string[] | undefined> } } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: {
        error: "Validation failed",
        details: result.error.flatten().fieldErrors as Record<string, string[] | undefined>,
      },
    };
  }
  return { success: true, data: result.data };
}
