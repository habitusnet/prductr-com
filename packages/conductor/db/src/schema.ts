import { pgTable, varchar, text, integer, bigint, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Organizations (Multi-Tenancy Root)
// ============================================================================

export const organizations = pgTable("organizations", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  plan: varchar("plan", { length: 50, enum: ["free", "pro", "enterprise"] }).default("free"),
  billingEmail: varchar("billing_email", { length: 255 }),
  apiKeys: text("api_keys").default("[]"), // JSON array
  settings: text("settings").default("{}"), // JSON object
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  id: varchar("id", { length: 255 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 255 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  role: varchar("role", { length: 50, enum: ["owner", "admin", "member", "viewer"] }).default(
    "member",
  ),
  invitedAt: timestamp("invited_at").defaultNow(),
  joinedAt: timestamp("joined_at"),
});

// ============================================================================
// Agents (Global + Organization-scoped)
// ============================================================================

export const agents = pgTable("agents", {
  id: varchar("id", { length: 255 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 255 }).references(() => organizations.id, {
    onDelete: "cascade",
  }),
  name: varchar("name", { length: 255 }).notNull(),
  provider: varchar("provider", {
    length: 50,
    enum: ["anthropic", "google", "openai", "meta", "custom"],
  }).notNull(),
  model: varchar("model", { length: 255 }).notNull(),
  capabilities: text("capabilities").default("[]"), // JSON array
  costPerTokenInput: numeric("cost_per_token_input", { precision: 10, scale: 8 }).default("0"),
  costPerTokenOutput: numeric("cost_per_token_output", { precision: 10, scale: 8 }).default("0"),
  quotaLimit: bigint("quota_limit", { mode: "number" }),
  quotaUsed: bigint("quota_used", { mode: "number" }).default(0),
  quotaResetAt: timestamp("quota_reset_at"),
  status: varchar("status", {
    length: 50,
    enum: ["idle", "working", "blocked", "offline"],
  }).default("idle"),
  lastHeartbeat: timestamp("last_heartbeat"),
  metadata: text("metadata").default("{}"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Projects
// ============================================================================

export const projects = pgTable("projects", {
  id: varchar("id", { length: 255 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 255 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  rootPath: text("root_path"),
  gitRemote: text("git_remote"),
  gitBranch: varchar("git_branch", { length: 255 }).default("main"),
  conflictStrategy: varchar("conflict_strategy", {
    length: 50,
    enum: ["lock", "merge", "zone", "review"],
  }).default("lock"),
  budgetTotal: numeric("budget_total", { precision: 10, scale: 2 }),
  budgetSpent: numeric("budget_spent", { precision: 10, scale: 2 }).default("0"),
  budgetAlertThreshold: integer("budget_alert_threshold").default(80),
  settings: text("settings").default("{}"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// Project Agents (Per-project agent configuration)
// ============================================================================

export const projectAgents = pgTable("project_agents", {
  id: varchar("id", { length: 255 }).primaryKey(),
  projectId: varchar("project_id", { length: 255 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id", { length: 255 })
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  role: varchar("role", {
    length: 50,
    enum: ["lead", "contributor", "reviewer", "observer"],
  }).default("contributor"),
  customInstructions: text("custom_instructions"),
  instructionsFile: text("instructions_file"),
  allowedPaths: text("allowed_paths").default("[]"),
  deniedPaths: text("denied_paths").default("[]"),
  tokenBudget: bigint("token_budget", { mode: "number" }),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Tasks
// ============================================================================

export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 255 }).primaryKey(),
  projectId: varchar("project_id", { length: 255 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id", { length: 255 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: varchar("status", {
    length: 50,
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
  priority: varchar("priority", {
    length: 50,
    enum: ["critical", "high", "medium", "low"],
  }).default("medium"),
  assignedTo: varchar("assigned_to", { length: 255 }).references(() => agents.id, {
    onDelete: "set null",
  }),
  claimedAt: timestamp("claimed_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  dueAt: timestamp("due_at"),
  dependencies: text("dependencies").default("[]"),
  blockedBy: varchar("blocked_by", { length: 255 }),
  estimatedTokens: bigint("estimated_tokens", { mode: "number" }),
  actualTokens: bigint("actual_tokens", { mode: "number" }),
  files: text("files").default("[]"),
  tags: text("tags").default("[]"),
  result: text("result"),
  errorMessage: text("error_message"),
  metadata: text("metadata").default("{}"),
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// Task Activities
// ============================================================================

export const taskActivities = pgTable("task_activities", {
  id: varchar("id", { length: 255 }).primaryKey(),
  taskId: varchar("task_id", { length: 255 })
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id", { length: 255 }),
  action: varchar("action", {
    length: 50,
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
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// File Locks
// ============================================================================

export const fileLocks = pgTable("file_locks", {
  id: varchar("id", { length: 255 }).primaryKey(),
  projectId: varchar("project_id", { length: 255 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  agentId: varchar("agent_id", { length: 255 }).notNull(),
  taskId: varchar("task_id", { length: 255 }).references(() => tasks.id, { onDelete: "set null" }),
  lockedAt: timestamp("locked_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// ============================================================================
// File Conflicts
// ============================================================================

export const fileConflicts = pgTable("file_conflicts", {
  id: varchar("id", { length: 255 }).primaryKey(),
  projectId: varchar("project_id", { length: 255 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  agents: text("agents").default("[]"),
  strategy: varchar("strategy", {
    length: 50,
    enum: ["lock", "merge", "zone", "review"],
  }).notNull(),
  resolution: varchar("resolution", {
    length: 50,
    enum: ["accepted", "rejected", "merged", "waiting"],
  }),
  resolvedBy: varchar("resolved_by", { length: 255 }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Cost Events
// ============================================================================

export const costEvents = pgTable("cost_events", {
  id: varchar("id", { length: 255 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 255 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  projectId: varchar("project_id", { length: 255 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id", { length: 255 }).notNull(),
  taskId: varchar("task_id", { length: 255 }),
  model: varchar("model", { length: 255 }).notNull(),
  tokensInput: bigint("tokens_input", { mode: "number" }).notNull(),
  tokensOutput: bigint("tokens_output", { mode: "number" }).notNull(),
  cost: numeric("cost", { precision: 10, scale: 6 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Escalations (Oversight Queue)
// ============================================================================

export const escalations = pgTable("escalations", {
  id: varchar("id", { length: 255 }).primaryKey(),
  projectId: varchar("project_id", { length: 255 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: varchar("type", {
    length: 50,
    enum: [
      "oauth_required",
      "merge_conflict",
      "task_review",
      "agent_error",
      "budget_exceeded",
      "manual_intervention",
    ],
  }).notNull(),
  priority: varchar("priority", {
    length: 50,
    enum: ["critical", "high", "normal", "low"],
  })
    .notNull()
    .default("normal"),
  status: varchar("status", {
    length: 50,
    enum: ["pending", "snoozed", "resolved", "escalated"],
  })
    .notNull()
    .default("pending"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  context: text("context").default("{}"), // JSON with taskId, agentId, etc.
  assignedTo: varchar("assigned_to", { length: 255 }), // userId
  resolvedBy: varchar("resolved_by", { length: 255 }), // userId
  resolution: text("resolution"),
  snoozedUntil: timestamp("snoozed_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// ============================================================================
// Agent Instances (Runtime tracking)
// ============================================================================

export const agentInstances = pgTable("agent_instances", {
  id: varchar("id", { length: 255 }).primaryKey(),
  agentId: varchar("agent_id", { length: 255 })
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  projectId: varchar("project_id", { length: 255 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
  status: varchar("status", {
    length: 50,
    enum: ["idle", "working", "blocked", "offline"],
  }).default("idle"),
  currentTaskId: varchar("current_task_id", { length: 255 }).references(() => tasks.id, {
    onDelete: "set null",
  }),
  lastHeartbeat: timestamp("last_heartbeat").notNull(),
  metadata: text("metadata").default("{}"),
  startedAt: timestamp("started_at").defaultNow(),
});

// ============================================================================
// Connector Configs
// ============================================================================

export const connectorConfigs = pgTable("connector_configs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 255 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  type: varchar("type", {
    length: 50,
    enum: ["github", "gitlab", "slack", "discord", "webhook"],
  }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  config: text("config").default("{}"),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
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

export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: text("password_hash"), // For local auth (optional if using OAuth)
  authProvider: varchar("auth_provider", {
    length: 50,
    enum: ["local", "google", "github"],
  }).default("local"),
  authProviderId: varchar("auth_provider_id", { length: 255 }), // External ID from OAuth provider
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// User Secrets (encrypted per-user API keys)
// ============================================================================

export const userSecrets = pgTable("user_secrets", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "E2B_API_KEY", "ANTHROPIC_API_KEY"
  encryptedValue: text("encrypted_value").notNull(), // AES-256-GCM encrypted
  iv: varchar("iv", { length: 255 }).notNull(), // Initialization vector for decryption
  authTag: varchar("auth_tag", { length: 255 }).notNull(), // GCM authentication tag
  provider: varchar("provider", { length: 255 }), // Optional: which service this key is for
  expiresAt: timestamp("expires_at"), // Optional expiration
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
