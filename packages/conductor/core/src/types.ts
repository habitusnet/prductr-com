import { z } from "zod";

// ============================================================================
// Organization Types (Multi-Tenancy)
// ============================================================================

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  plan: z.enum(["free", "pro", "enterprise"]).default("free"),
  billingEmail: z.string().email().optional(),
  apiKeys: z.array(z.string()).default([]),
  settings: z.record(z.unknown()).default({}),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Organization = z.infer<typeof OrganizationSchema>;

export const OrganizationMemberSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
  invitedAt: z.date().default(() => new Date()),
  joinedAt: z.date().optional(),
});

export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

// ============================================================================
// Agent Types
// ============================================================================

export type AgentId =
  | "claude"
  | "gemini"
  | "codex"
  | "gpt4"
  | "llama"
  | (string & {});
export type AgentStatus = "idle" | "working" | "blocked" | "offline";
export type AgentProvider =
  | "anthropic"
  | "google"
  | "openai"
  | "meta"
  | "custom";

export const AgentProfileSchema = z.object({
  id: z.string(),
  organizationId: z.string().uuid().optional(), // null = global agent
  name: z.string(),
  provider: z.enum(["anthropic", "google", "openai", "meta", "custom"]),
  model: z.string(), // e.g., 'claude-3-opus', 'gemini-pro'
  capabilities: z.array(z.string()),
  costPerToken: z.object({
    input: z.number(),
    output: z.number(),
  }),
  quotaLimit: z.number().optional(),
  quotaUsed: z.number().optional(),
  quotaResetAt: z.date().optional(),
  status: z.enum(["idle", "working", "blocked", "offline"]).default("idle"),
  lastHeartbeat: z.date().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type AgentProfile = z.infer<typeof AgentProfileSchema>;

// ============================================================================
// Project Types
// ============================================================================

export const BudgetSchema = z.object({
  total: z.number(),
  spent: z.number().default(0),
  currency: z.literal("USD").default("USD"),
  alertThreshold: z.number().default(80), // percentage
});

export type Budget = z.infer<typeof BudgetSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  rootPath: z.string().optional(), // Local path if available
  gitRemote: z.string().url().optional(),
  gitBranch: z.string().default("main"),
  conflictStrategy: z.enum(["lock", "merge", "zone", "review"]).default("lock"),
  budget: BudgetSchema.optional(),
  settings: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Project = z.infer<typeof ProjectSchema>;

// ============================================================================
// Project Agent Binding (per-project agent config)
// ============================================================================

export const ProjectAgentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  agentId: z.string(),
  role: z
    .enum(["lead", "contributor", "reviewer", "observer"])
    .default("contributor"),
  customInstructions: z.string().optional(), // Appended to base instructions
  instructionsFile: z.string().optional(), // e.g., 'CLAUDE.md', 'GEMINI.md'
  allowedPaths: z.array(z.string()).default([]), // File path patterns
  deniedPaths: z.array(z.string()).default([]),
  tokenBudget: z.number().optional(), // Per-project agent budget
  isEnabled: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
});

export type ProjectAgent = z.infer<typeof ProjectAgentSchema>;

// ============================================================================
// Task Types
// ============================================================================

export type TaskStatus =
  | "pending"
  | "claimed"
  | "in_progress"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

export type TaskPriority = "critical" | "high" | "medium" | "low";

export const TaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  parentId: z.string().uuid().optional(), // For subtasks
  title: z.string(),
  description: z.string().optional(),
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
    .default("pending"),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  assignedTo: z.string().optional(), // Agent ID
  claimedAt: z.date().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  dueAt: z.date().optional(),
  dependencies: z.array(z.string()).default([]), // Task IDs
  blockedBy: z.array(z.string()).optional(),
  estimatedTokens: z.number().optional(),
  actualTokens: z.number().optional(),
  files: z.array(z.string()).default([]), // Files touched
  tags: z.array(z.string()).default([]),
  result: z.string().optional(), // Completion summary
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdBy: z.string().optional(), // User or agent who created
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Task = z.infer<typeof TaskSchema>;

export interface TaskFilters {
  projectId?: string;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assignedTo?: AgentId;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
}

// ============================================================================
// Task Activity Log
// ============================================================================

export const TaskActivitySchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  agentId: z.string().optional(),
  action: z.enum([
    "created",
    "claimed",
    "started",
    "progress_update",
    "completed",
    "failed",
    "blocked",
    "unblocked",
    "reassigned",
    "cancelled",
    "commented",
  ]),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date().default(() => new Date()),
});

export type TaskActivity = z.infer<typeof TaskActivitySchema>;

// ============================================================================
// Conflict Types
// ============================================================================

export type ConflictStrategy = "lock" | "merge" | "zone" | "review";
export type ConflictResolution = "accepted" | "rejected" | "merged" | "waiting";

export const FileConflictSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  filePath: z.string(),
  agents: z.array(z.string()),
  strategy: z.enum(["lock", "merge", "zone", "review"]),
  resolvedAt: z.date().optional(),
  resolution: z.enum(["accepted", "rejected", "merged", "waiting"]).optional(),
  resolvedBy: z.string().optional(), // User or agent
  createdAt: z.date().default(() => new Date()),
});

export type FileConflict = z.infer<typeof FileConflictSchema>;

export const FileLockSchema = z.object({
  id: z.string().uuid(),
  filePath: z.string(),
  projectId: z.string().uuid(),
  agentId: z.string(),
  taskId: z.string().uuid().optional(),
  lockedAt: z.date().default(() => new Date()),
  expiresAt: z.date().optional(),
});

export type FileLock = z.infer<typeof FileLockSchema>;

// ============================================================================
// Cost Types
// ============================================================================

export const CostEventSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  agentId: z.string(),
  taskId: z.string().uuid().optional(),
  model: z.string(),
  tokensInput: z.number(),
  tokensOutput: z.number(),
  cost: z.number(), // In USD
  createdAt: z.date().default(() => new Date()),
});

export type CostEvent = z.infer<typeof CostEventSchema>;

export interface UsageReport {
  organizationId: string;
  projectId?: string;
  period: { start: Date; end: Date };
  total: number;
  byAgent: Record<AgentId, number>;
  byProject: Record<string, number>;
  byTask: Record<string, number>;
  remaining: number;
  alertTriggered: boolean;
}

// ============================================================================
// Auction Types
// ============================================================================

export interface Bid {
  agentId: AgentId;
  taskId: string;
  estimatedTokens: number;
  estimatedCost: number;
  confidence: number; // 0-1
  capabilities: string[];
  submittedAt: Date;
}

export interface AuctionResult {
  taskId: string;
  winner: AgentId | null;
  bids: Bid[];
  reason: string;
  awardedAt: Date;
}

// ============================================================================
// Message Types (Pub/Sub)
// ============================================================================

export type MessageType =
  | "task:created"
  | "task:claimed"
  | "task:started"
  | "task:progress"
  | "task:completed"
  | "task:failed"
  | "task:blocked"
  | "task:cancelled"
  | "agent:status"
  | "agent:heartbeat"
  | "agent:registered"
  | "conflict:detected"
  | "conflict:resolved"
  | "budget:alert"
  | "budget:exceeded"
  | "project:created"
  | "project:updated";

export interface Message<T = unknown> {
  id: string;
  type: MessageType;
  organizationId: string;
  projectId?: string;
  payload: T;
  timestamp: Date;
  source: AgentId | "system" | "user";
}

// ============================================================================
// Agent Instance (Runtime)
// ============================================================================

export const AgentInstanceSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string(),
  projectId: z.string().uuid(),
  sessionId: z.string(), // Unique per session
  status: z.enum(["idle", "working", "blocked", "offline"]),
  currentTaskId: z.string().uuid().optional(),
  lastHeartbeat: z.date(),
  metadata: z.record(z.unknown()).default({}),
  startedAt: z.date().default(() => new Date()),
});

export type AgentInstance = z.infer<typeof AgentInstanceSchema>;

// ============================================================================
// Connector Config
// ============================================================================

export const ConnectorConfigSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  type: z.enum(["github", "gitlab", "slack", "discord", "webhook"]),
  name: z.string(),
  config: z.record(z.unknown()), // Type-specific config
  isEnabled: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
});

export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>;

// ============================================================================
// Access Request Types (Agent Onboarding)
// ============================================================================

export type AccessRequestStatus = "pending" | "approved" | "denied" | "expired";

export const AccessRequestSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  agentId: z.string(),
  agentName: z.string(),
  agentType: z.enum(["claude", "gemini", "codex", "gpt4", "llama", "custom"]),
  capabilities: z.array(z.string()).default([]),
  requestedRole: z
    .enum(["lead", "contributor", "reviewer", "observer"])
    .default("contributor"),
  status: z
    .enum(["pending", "approved", "denied", "expired"])
    .default("pending"),
  requestedAt: z.date().default(() => new Date()),
  reviewedAt: z.date().optional(),
  reviewedBy: z.string().optional(), // User who approved/denied
  expiresAt: z.date().optional(), // When access expires (if approved)
  denialReason: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type AccessRequest = z.infer<typeof AccessRequestSchema>;

export interface AccessRequestFilters {
  projectId?: string;
  status?: AccessRequestStatus | AccessRequestStatus[];
  agentType?: string;
}

// ============================================================================
// Project Context Types (Agent Onboarding & Drift Prevention)
// ============================================================================

export const ProjectContextSchema = z.object({
  // Project identity
  projectId: z.string().uuid(),
  projectName: z.string(),

  // Current focus and goals
  currentFocus: z.string().optional(), // What the team is working on now
  projectGoals: z.array(z.string()).default([]), // High-level objectives

  // Agent-specific instructions
  agentInstructions: z.string().optional(), // From CLAUDE.md, GEMINI.md, etc.

  // Coding standards and patterns
  styleGuide: z.string().optional(), // Code style expectations
  relevantPatterns: z
    .array(
      z.object({
        file: z.string(),
        description: z.string(),
        lineRange: z.string().optional(), // e.g., "45-60"
      }),
    )
    .default([]),

  // Zone/scope restrictions
  allowedPaths: z.array(z.string()).default([]), // Glob patterns
  deniedPaths: z.array(z.string()).default([]),

  // Checkpoint reminders
  checkpointRules: z.array(z.string()).default([]), // e.g., "Run tests before commit"

  // Task-specific context (added when claiming a task)
  taskContext: z
    .object({
      taskId: z.string(),
      taskTitle: z.string(),
      taskDescription: z.string().optional(),
      expectedFiles: z.array(z.string()).default([]),
      relatedTasks: z.array(z.string()).default([]),
    })
    .optional(),

  // Metadata
  generatedAt: z.date().default(() => new Date()),
  isFirstTask: z.boolean().default(false), // First task for this agent in project
});

export type ProjectContext = z.infer<typeof ProjectContextSchema>;

export const ProjectOnboardingConfigSchema = z.object({
  // Welcome message shown to all agents
  welcomeMessage: z.string().optional(),

  // Per-agent-type instructions file paths
  agentInstructionsFiles: z.record(z.string()).default({}), // e.g., { claude: 'CLAUDE.md', gemini: 'GEMINI.md' }

  // Current sprint/focus
  currentFocus: z.string().optional(),

  // Project goals
  goals: z.array(z.string()).default([]),

  // Style guide content or file path
  styleGuide: z.string().optional(),

  // Checkpoint configuration
  checkpointRules: z.array(z.string()).default([]),
  checkpointEveryNTasks: z.number().default(3),

  // Auto-inject context refresh
  autoRefreshContext: z.boolean().default(true),
});

export type ProjectOnboardingConfig = z.infer<
  typeof ProjectOnboardingConfigSchema
>;

// ============================================================================
// Agent Checkpoint Types (Context Rollover)
// ============================================================================

export type CheckpointType = "manual" | "auto" | "context_exhaustion";

export const AgentCheckpointSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  agentId: z.string(),
  taskId: z.string().uuid().optional(),
  beadId: z.string().optional(), // gt-xxxxx format
  checkpointType: z
    .enum(["manual", "auto", "context_exhaustion"])
    .default("manual"),
  stage: z.string(), // Current work stage description
  context: z.object({
    filesModified: z.array(z.string()).default([]),
    completedSteps: z.array(z.string()).default([]),
    nextSteps: z.array(z.string()).default([]),
    blockers: z.array(z.string()).default([]),
    tokenCount: z.number().optional(),
  }),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date().default(() => new Date()),
  expiresAt: z.date().optional(),
});

export type AgentCheckpoint = z.infer<typeof AgentCheckpointSchema>;

// ============================================================================
// Bead & Convoy Types (Gastown Integration)
// ============================================================================

export const BeadSchema = z.object({
  id: z.string().regex(/^gt-[a-z0-9]{5}$/), // gt-xxxxx format
  title: z.string(),
  type: z.enum(["spike", "feature", "fix", "chore", "refactor"]).optional(),
  complexity: z.enum(["S", "M", "L", "XL"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  status: z
    .enum(["pending", "in_progress", "complete", "blocked"])
    .default("pending"),
  dependencies: z.array(z.string()).default([]), // Other bead IDs
  acceptance_criteria: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export type Bead = z.infer<typeof BeadSchema>;

export const ConvoySchema = z.object({
  id: z.string(), // convoy-NNN or eco-convoy-NNN format
  name: z.string(),
  beads: z.array(z.string()).default([]), // Bead IDs
  assigned_to: z.string().optional(),
  status: z
    .enum(["pending", "in_progress", "complete", "blocked"])
    .default("pending"),
  metadata: z.record(z.unknown()).default({}),
});

export type Convoy = z.infer<typeof ConvoySchema>;
