import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Organizations (Multi-Tenancy Root)
// ============================================================================

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan", { enum: ["free", "pro", "enterprise"] }).default("free"),
  billingEmail: text("billing_email"),
  apiKeys: text("api_keys").default("[]"), // JSON array
  settings: text("settings").default("{}"), // JSON object
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export const organizationMembers = sqliteTable("organization_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role", { enum: ["owner", "admin", "member", "viewer"] }).default(
    "member",
  ),
  invitedAt: text("invited_at").default("CURRENT_TIMESTAMP"),
  joinedAt: text("joined_at"),
});

// ============================================================================
// Agents (Global + Organization-scoped)
// ============================================================================

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  provider: text("provider", {
    enum: ["anthropic", "google", "openai", "meta", "custom"],
  }).notNull(),
  model: text("model").notNull(),
  capabilities: text("capabilities").default("[]"), // JSON array
  costPerTokenInput: real("cost_per_token_input").default(0),
  costPerTokenOutput: real("cost_per_token_output").default(0),
  quotaLimit: integer("quota_limit"),
  quotaUsed: integer("quota_used").default(0),
  quotaResetAt: text("quota_reset_at"),
  status: text("status", {
    enum: ["idle", "working", "blocked", "offline"],
  }).default("idle"),
  lastHeartbeat: text("last_heartbeat"),
  metadata: text("metadata").default("{}"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ============================================================================
// Projects
// ============================================================================

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  rootPath: text("root_path"),
  gitRemote: text("git_remote"),
  gitBranch: text("git_branch").default("main"),
  conflictStrategy: text("conflict_strategy", {
    enum: ["lock", "merge", "zone", "review"],
  }).default("lock"),
  budgetTotal: real("budget_total"),
  budgetSpent: real("budget_spent").default(0),
  budgetAlertThreshold: integer("budget_alert_threshold").default(80),
  settings: text("settings").default("{}"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

// ============================================================================
// Project Agents (Per-project agent configuration)
// ============================================================================

export const projectAgents = sqliteTable("project_agents", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  role: text("role", {
    enum: ["lead", "contributor", "reviewer", "observer"],
  }).default("contributor"),
  customInstructions: text("custom_instructions"),
  instructionsFile: text("instructions_file"),
  allowedPaths: text("allowed_paths").default("[]"),
  deniedPaths: text("denied_paths").default("[]"),
  tokenBudget: integer("token_budget"),
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ============================================================================
// Tasks
// ============================================================================

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: [
      "pending",
      "claimed",
      "in_progress",
      "completed",
      "failed",
      "blocked",
      "cancelled",
    ],
  }).default("pending"),
  priority: text("priority", {
    enum: ["critical", "high", "medium", "low"],
  }).default("medium"),
  assignedTo: text("assigned_to").references(() => agents.id, {
    onDelete: "set null",
  }),
  claimedAt: text("claimed_at"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  dueAt: text("due_at"),
  dependencies: text("dependencies").default("[]"),
  blockedBy: text("blocked_by"),
  estimatedTokens: integer("estimated_tokens"),
  actualTokens: integer("actual_tokens"),
  files: text("files").default("[]"),
  tags: text("tags").default("[]"),
  result: text("result"),
  errorMessage: text("error_message"),
  metadata: text("metadata").default("{}"),
  createdBy: text("created_by"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

// ============================================================================
// Task Activities
// ============================================================================

export const taskActivities = sqliteTable("task_activities", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  agentId: text("agent_id"),
  action: text("action", {
    enum: [
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
    ],
  }).notNull(),
  description: text("description"),
  metadata: text("metadata").default("{}"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ============================================================================
// File Locks
// ============================================================================

export const fileLocks = sqliteTable("file_locks", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  agentId: text("agent_id").notNull(),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  lockedAt: text("locked_at").default("CURRENT_TIMESTAMP"),
  expiresAt: text("expires_at"),
});

// ============================================================================
// File Conflicts
// ============================================================================

export const fileConflicts = sqliteTable("file_conflicts", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  agents: text("agents").default("[]"),
  strategy: text("strategy", {
    enum: ["lock", "merge", "zone", "review"],
  }).notNull(),
  resolution: text("resolution", {
    enum: ["accepted", "rejected", "merged", "waiting"],
  }),
  resolvedBy: text("resolved_by"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ============================================================================
// Cost Events
// ============================================================================

export const costEvents = sqliteTable("cost_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull(),
  taskId: text("task_id"),
  model: text("model").notNull(),
  tokensInput: integer("tokens_input").notNull(),
  tokensOutput: integer("tokens_output").notNull(),
  cost: real("cost").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ============================================================================
// Escalations (Oversight Queue)
// ============================================================================

export const escalations = sqliteTable("escalations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: [
      "oauth_required",
      "merge_conflict",
      "task_review",
      "agent_error",
      "budget_exceeded",
      "manual_intervention",
    ],
  }).notNull(),
  priority: text("priority", {
    enum: ["critical", "high", "normal", "low"],
  })
    .notNull()
    .default("normal"),
  status: text("status", {
    enum: ["pending", "snoozed", "resolved", "escalated"],
  })
    .notNull()
    .default("pending"),
  title: text("title").notNull(),
  description: text("description"),
  context: text("context").default("{}"), // JSON with taskId, agentId, etc.
  assignedTo: text("assigned_to"), // userId
  resolvedBy: text("resolved_by"), // userId
  resolution: text("resolution"),
  snoozedUntil: text("snoozed_until"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
  resolvedAt: text("resolved_at"),
});

// ============================================================================
// Agent Instances (Runtime tracking)
// ============================================================================

export const agentInstances = sqliteTable("agent_instances", {
  id: text("id").primaryKey(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull().unique(),
  status: text("status", {
    enum: ["idle", "working", "blocked", "offline"],
  }).default("idle"),
  currentTaskId: text("current_task_id").references(() => tasks.id, {
    onDelete: "set null",
  }),
  lastHeartbeat: text("last_heartbeat").notNull(),
  metadata: text("metadata").default("{}"),
  startedAt: text("started_at").default("CURRENT_TIMESTAMP"),
});

// ============================================================================
// Connector Configs
// ============================================================================

export const connectorConfigs = sqliteTable("connector_configs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["github", "gitlab", "slack", "discord", "webhook"],
  }).notNull(),
  name: text("name").notNull(),
  config: text("config").default("{}"),
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ============================================================================
// Relations
// ============================================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  projects: many(projects),
  agents: many(agents),
  connectorConfigs: many(connectorConfigs),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  tasks: many(tasks),
  projectAgents: many(projectAgents),
  fileLocks: many(fileLocks),
  fileConflicts: many(fileConflicts),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  assignedAgent: one(agents, {
    fields: [tasks.assignedTo],
    references: [agents.id],
  }),
  parent: one(tasks, {
    fields: [tasks.parentId],
    references: [tasks.id],
  }),
  activities: many(taskActivities),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [agents.organizationId],
    references: [organizations.id],
  }),
  projectAgents: many(projectAgents),
  instances: many(agentInstances),
}));

// ============================================================================
// Users (for per-user secrets and preferences)
// ============================================================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"), // For local auth (optional if using OAuth)
  authProvider: text("auth_provider", {
    enum: ["local", "google", "github"],
  }).default("local"),
  authProviderId: text("auth_provider_id"), // External ID from OAuth provider
  avatarUrl: text("avatar_url"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

// ============================================================================
// User Secrets (encrypted per-user API keys)
// ============================================================================

export const userSecrets = sqliteTable("user_secrets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "E2B_API_KEY", "ANTHROPIC_API_KEY"
  encryptedValue: text("encrypted_value").notNull(), // AES-256-GCM encrypted
  iv: text("iv").notNull(), // Initialization vector for decryption
  authTag: text("auth_tag").notNull(), // GCM authentication tag
  provider: text("provider"), // Optional: which service this key is for
  expiresAt: text("expires_at"), // Optional expiration
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

// ============================================================================
// User Relations
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  secrets: many(userSecrets),
  organizationMemberships: many(organizationMembers),
}));

export const userSecretsRelations = relations(userSecrets, ({ one }) => ({
  user: one(users, {
    fields: [userSecrets.userId],
    references: [users.id],
  }),
}));
