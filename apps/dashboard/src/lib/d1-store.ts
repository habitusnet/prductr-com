/**
 * D1-compatible state store for Cloudflare Workers
 * This mirrors the SQLiteStateStore API but uses async D1 operations
 */

// Stub type for D1Database (Cloudflare Workers type)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Database = any;

// Type definitions (simplified from @conductor/core)
interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  rootPath?: string;
  gitRemote?: string;
  gitBranch: string;
  conflictStrategy: "lock" | "merge" | "zone" | "review";
  settings: Record<string, unknown>;
  isActive: boolean;
  budget?: { total: number; spent: number; alertThreshold: number };
  createdAt: Date;
  updatedAt: Date;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status:
    | "pending"
    | "claimed"
    | "in_progress"
    | "completed"
    | "failed"
    | "blocked"
    | "cancelled";
  priority: "critical" | "high" | "medium" | "low";
  assignedTo?: string;
  claimedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  dependencies: string[];
  blockedBy?: string[];
  estimatedTokens?: number;
  actualTokens?: number;
  files: string[];
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentProfile {
  id: string;
  name: string;
  provider: string;
  model?: string;
  status: "idle" | "working" | "blocked" | "offline";
  capabilities: string[];
  costPerToken: { input: number; output: number };
  lastHeartbeat?: Date;
  metadata: Record<string, unknown>;
}

interface AccessRequest {
  id: string;
  projectId: string;
  agentId: string;
  agentName: string;
  agentType: string;
  capabilities: string[];
  requestedRole: "lead" | "contributor" | "reviewer" | "observer";
  status: "pending" | "approved" | "denied" | "expired";
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  expiresAt?: Date;
  denialReason?: string;
  metadata: Record<string, unknown>;
}

interface OnboardingConfig {
  welcomeMessage?: string;
  currentFocus?: string;
  goals: string[];
  styleGuide?: string;
  checkpointRules: string[];
  checkpointEveryNTasks: number;
  autoRefreshContext: boolean;
  agentInstructionsFiles: Record<string, string>;
}

interface CostEvent {
  id: string;
  organizationId: string;
  projectId: string;
  agentId: string;
  model: string;
  taskId?: string;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  createdAt: Date;
}

interface TaskFilters {
  status?: Task["status"] | Task["status"][];
  priority?: Task["priority"] | Task["priority"][];
  assignedTo?: string;
  tags?: string[];
}

interface AccessRequestFilters {
  status?: AccessRequest["status"] | AccessRequest["status"][];
}

/**
 * D1 State Store - Edge-compatible database operations
 */
export class D1StateStore {
  constructor(private db: D1Database) {}

  // ============================================================================
  // Project Methods
  // ============================================================================

  async getProject(projectId: string): Promise<Project | null> {
    const row = await this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .bind(projectId)
      .first();

    if (!row) return null;
    return this.rowToProject(row);
  }

  // ============================================================================
  // Task Methods
  // ============================================================================

  async listTasks(projectId: string, filters?: TaskFilters): Promise<Task[]> {
    let query = "SELECT * FROM tasks WHERE project_id = ?";
    const params: unknown[] = [projectId];

    if (filters?.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      query += ` AND status IN (${statuses.map(() => "?").join(",")})`;
      params.push(...statuses);
    }

    if (filters?.priority) {
      const priorities = Array.isArray(filters.priority)
        ? filters.priority
        : [filters.priority];
      query += ` AND priority IN (${priorities.map(() => "?").join(",")})`;
      params.push(...priorities);
    }

    if (filters?.assignedTo) {
      query += " AND assigned_to = ?";
      params.push(filters.assignedTo);
    }

    query += " ORDER BY created_at DESC";

    const stmt = this.db.prepare(query);
    const result = await stmt.bind(...params).all();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.results || []).map((row: any) => this.rowToTask(row));
  }

  async getTask(taskId: string): Promise<Task | null> {
    const row = await this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .bind(taskId)
      .first();

    if (!row) return null;
    return this.rowToTask(row);
  }

  // ============================================================================
  // Agent Methods
  // ============================================================================

  async listAgents(projectId: string): Promise<AgentProfile[]> {
    const result = await this.db
      .prepare("SELECT * FROM agents WHERE project_id = ?")
      .bind(projectId)
      .all();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.results || []).map((row: any) => this.rowToAgent(row));
  }

  async getAgent(agentId: string): Promise<AgentProfile | null> {
    const row = await this.db
      .prepare("SELECT * FROM agents WHERE id = ?")
      .bind(agentId)
      .first();

    if (!row) return null;
    return this.rowToAgent(row);
  }

  // ============================================================================
  // Access Request Methods
  // ============================================================================

  async listAccessRequests(
    projectId: string,
    filters?: AccessRequestFilters,
  ): Promise<AccessRequest[]> {
    let query = "SELECT * FROM access_requests WHERE project_id = ?";
    const params: unknown[] = [projectId];

    if (filters?.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      query += ` AND status IN (${statuses.map(() => "?").join(",")})`;
      params.push(...statuses);
    }

    query += " ORDER BY requested_at DESC";

    const stmt = this.db.prepare(query);
    const result = await stmt.bind(...params).all();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.results || []).map((row: any) => this.rowToAccessRequest(row));
  }

  async approveAccessRequest(
    requestId: string,
    reviewedBy: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(); // 30 days

    await this.db
      .prepare(
        `UPDATE access_requests SET status = 'approved', reviewed_at = ?, reviewed_by = ?, expires_at = ? WHERE id = ?`,
      )
      .bind(now, reviewedBy, expiresAt, requestId)
      .run();
  }

  async denyAccessRequest(
    requestId: string,
    reviewedBy: string,
    reason?: string,
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE access_requests SET status = 'denied', reviewed_at = ?, reviewed_by = ?, denial_reason = ? WHERE id = ?`,
      )
      .bind(now, reviewedBy, reason || null, requestId)
      .run();
  }

  async getAccessRequestSummary(projectId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    denied: number;
    expired: number;
  }> {
    const result = await this.db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied,
          SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
        FROM access_requests WHERE project_id = ?`,
      )
      .bind(projectId)
      .first();

    return {
      total: Number(result?.total || 0),
      pending: Number(result?.pending || 0),
      approved: Number(result?.approved || 0),
      denied: Number(result?.denied || 0),
      expired: Number(result?.expired || 0),
    };
  }

  // ============================================================================
  // Onboarding Config Methods
  // ============================================================================

  async getOnboardingConfig(
    projectId: string,
  ): Promise<OnboardingConfig | null> {
    const row = await this.db
      .prepare("SELECT * FROM project_onboarding WHERE project_id = ?")
      .bind(projectId)
      .first();

    if (!row) return null;

    return {
      welcomeMessage: row.welcome_message as string | undefined,
      currentFocus: row.current_focus as string | undefined,
      goals: JSON.parse((row.goals as string) || "[]"),
      styleGuide: row.style_guide as string | undefined,
      checkpointRules: JSON.parse((row.checkpoint_rules as string) || "[]"),
      checkpointEveryNTasks: Number(row.checkpoint_every_n_tasks || 3),
      autoRefreshContext: Boolean(row.auto_refresh_context),
      agentInstructionsFiles: JSON.parse(
        (row.agent_instructions as string) || "{}",
      ),
    };
  }

  async setOnboardingConfig(
    projectId: string,
    config: Partial<OnboardingConfig>,
  ): Promise<void> {
    const existing = await this.getOnboardingConfig(projectId);

    if (existing) {
      const updates: string[] = [];
      const values: unknown[] = [];

      if (config.welcomeMessage !== undefined) {
        updates.push("welcome_message = ?");
        values.push(config.welcomeMessage || null);
      }
      if (config.currentFocus !== undefined) {
        updates.push("current_focus = ?");
        values.push(config.currentFocus || null);
      }
      if (config.goals !== undefined) {
        updates.push("goals = ?");
        values.push(JSON.stringify(config.goals));
      }
      if (config.styleGuide !== undefined) {
        updates.push("style_guide = ?");
        values.push(config.styleGuide || null);
      }
      if (config.checkpointRules !== undefined) {
        updates.push("checkpoint_rules = ?");
        values.push(JSON.stringify(config.checkpointRules));
      }
      if (config.checkpointEveryNTasks !== undefined) {
        updates.push("checkpoint_every_n_tasks = ?");
        values.push(config.checkpointEveryNTasks);
      }
      if (config.autoRefreshContext !== undefined) {
        updates.push("auto_refresh_context = ?");
        values.push(config.autoRefreshContext ? 1 : 0);
      }
      if (config.agentInstructionsFiles !== undefined) {
        updates.push("agent_instructions = ?");
        values.push(JSON.stringify(config.agentInstructionsFiles));
      }

      updates.push("updated_at = datetime('now')");
      values.push(projectId);

      await this.db
        .prepare(
          `UPDATE project_onboarding SET ${updates.join(", ")} WHERE project_id = ?`,
        )
        .bind(...values)
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO project_onboarding (project_id, welcome_message, current_focus, goals, style_guide, checkpoint_rules, checkpoint_every_n_tasks, auto_refresh_context, agent_instructions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          projectId,
          config.welcomeMessage || null,
          config.currentFocus || null,
          JSON.stringify(config.goals || []),
          config.styleGuide || null,
          JSON.stringify(config.checkpointRules || []),
          config.checkpointEveryNTasks || 3,
          config.autoRefreshContext !== false ? 1 : 0,
          JSON.stringify(config.agentInstructionsFiles || {}),
        )
        .run();
    }
  }

  // ============================================================================
  // Cost Methods
  // ============================================================================

  async getProjectSpend(projectId: string): Promise<number> {
    const result = await this.db
      .prepare(
        "SELECT SUM(cost) as total FROM cost_events WHERE project_id = ?",
      )
      .bind(projectId)
      .first();

    return Number(result?.total || 0);
  }

  async getCostEvents(projectId: string): Promise<CostEvent[]> {
    const result = await this.db
      .prepare(
        "SELECT * FROM cost_events WHERE project_id = ? ORDER BY created_at DESC LIMIT 100",
      )
      .bind(projectId)
      .all();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.results || []).map((row: any) => ({
      id: row.id as string,
      organizationId: row.organization_id as string,
      projectId: row.project_id as string,
      agentId: row.agent_id as string,
      model: row.model as string,
      taskId: row.task_id as string | undefined,
      tokensInput: Number(row.tokens_input),
      tokensOutput: Number(row.tokens_output),
      cost: Number(row.cost),
      createdAt: new Date(row.created_at as string),
    }));
  }

  // ============================================================================
  // Conflict & Lock Methods
  // ============================================================================

  async getUnresolvedConflicts(projectId: string): Promise<
    {
      id: string;
      filePath: string;
      agents: string[];
      strategy: string;
      createdAt: string;
    }[]
  > {
    const result = await this.db
      .prepare(
        "SELECT * FROM conflicts WHERE project_id = ? AND resolved_at IS NULL ORDER BY created_at DESC",
      )
      .bind(projectId)
      .all();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.results || []).map((row: any) => ({
      id: row.id as string,
      filePath: row.file_path as string,
      agents: JSON.parse((row.agents as string) || "[]"),
      strategy: row.strategy as string,
      createdAt: row.created_at as string,
    }));
  }

  async getActiveLocks(projectId: string): Promise<
    {
      filePath: string;
      agentId: string;
      lockedAt: string;
      expiresAt: string;
    }[]
  > {
    const result = await this.db
      .prepare(
        "SELECT * FROM file_locks WHERE project_id = ? AND expires_at > datetime('now') ORDER BY locked_at DESC",
      )
      .bind(projectId)
      .all();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.results || []).map((row: any) => ({
      filePath: row.file_path as string,
      agentId: row.agent_id as string,
      lockedAt: row.locked_at as string,
      expiresAt: row.expires_at as string,
    }));
  }

  async resolveConflict(
    projectId: string,
    conflictId: string,
    resolution: string,
  ): Promise<void> {
    await this.db
      .prepare(
        'UPDATE conflicts SET resolved_at = datetime("now"), resolution = ? WHERE id = ? AND project_id = ?',
      )
      .bind(resolution, conflictId, projectId)
      .run();
  }

  async releaseLock(
    projectId: string,
    filePath: string,
    agentId: string,
  ): Promise<void> {
    await this.db
      .prepare(
        "DELETE FROM file_locks WHERE project_id = ? AND file_path = ? AND agent_id = ?",
      )
      .bind(projectId, filePath, agentId)
      .run();
  }

  // ============================================================================
  // Task Update Methods
  // ============================================================================

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      setClauses.push("status = ?");
      values.push(updates.status);
    }
    if (updates.assignedTo !== undefined) {
      setClauses.push("assigned_to = ?");
      values.push(updates.assignedTo);
    }
    if (updates.blockedBy !== undefined) {
      setClauses.push("blocked_by = ?");
      values.push(JSON.stringify(updates.blockedBy));
    }

    if (setClauses.length === 0) return;

    setClauses.push("updated_at = datetime('now')");
    values.push(taskId);

    await this.db
      .prepare(`UPDATE tasks SET ${setClauses.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  // ============================================================================
  // Agent Update Methods
  // ============================================================================

  async updateAgentStatus(agentId: string, status: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE agents SET status = ?, last_heartbeat = datetime('now') WHERE id = ?",
      )
      .bind(status, agentId)
      .run();
  }

  // ============================================================================
  // Row Converters
  // ============================================================================

  private rowToProject(row: Record<string, unknown>): Project {
    return {
      id: row.id as string,
      organizationId: row.organization_id as string,
      name: row.name as string,
      slug: row.slug as string,
      rootPath: row.root_path as string | undefined,
      gitRemote: row.git_remote as string | undefined,
      gitBranch: (row.git_branch as string) || "main",
      conflictStrategy:
        (row.conflict_strategy as Project["conflictStrategy"]) || "lock",
      settings: JSON.parse((row.settings as string) || "{}"),
      isActive: Boolean(row.is_active),
      budget: row.budget_total
        ? {
            total: Number(row.budget_total),
            spent: Number(row.budget_spent || 0),
            alertThreshold: Number(row.budget_alert_threshold || 80),
          }
        : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private rowToTask(row: Record<string, unknown>): Task {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      title: row.title as string,
      description: row.description as string | undefined,
      status: (row.status as Task["status"]) || "pending",
      priority: (row.priority as Task["priority"]) || "medium",
      assignedTo: row.assigned_to as string | undefined,
      claimedAt: row.claimed_at
        ? new Date(row.claimed_at as string)
        : undefined,
      startedAt: row.started_at
        ? new Date(row.started_at as string)
        : undefined,
      completedAt: row.completed_at
        ? new Date(row.completed_at as string)
        : undefined,
      dependencies: JSON.parse((row.dependencies as string) || "[]"),
      blockedBy: row.blocked_by
        ? JSON.parse(row.blocked_by as string)
        : undefined,
      estimatedTokens: row.estimated_tokens
        ? Number(row.estimated_tokens)
        : undefined,
      actualTokens: row.actual_tokens ? Number(row.actual_tokens) : undefined,
      files: JSON.parse((row.files as string) || "[]"),
      tags: JSON.parse((row.tags as string) || "[]"),
      metadata: JSON.parse((row.metadata as string) || "{}"),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(
        (row.updated_at as string) || (row.created_at as string),
      ),
    };
  }

  private rowToAgent(row: Record<string, unknown>): AgentProfile {
    return {
      id: row.id as string,
      name: row.name as string,
      provider: (row.provider as string) || "custom",
      model: row.model as string | undefined,
      status: (row.status as AgentProfile["status"]) || "offline",
      capabilities: JSON.parse((row.capabilities as string) || "[]"),
      costPerToken: {
        input: Number(row.cost_input || 0),
        output: Number(row.cost_output || 0),
      },
      lastHeartbeat: row.last_heartbeat
        ? new Date(row.last_heartbeat as string)
        : undefined,
      metadata: JSON.parse((row.metadata as string) || "{}"),
    };
  }

  private rowToAccessRequest(row: Record<string, unknown>): AccessRequest {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      agentId: row.agent_id as string,
      agentName: row.agent_name as string,
      agentType: (row.agent_type as string) || "custom",
      capabilities: JSON.parse((row.capabilities as string) || "[]"),
      requestedRole:
        (row.requested_role as AccessRequest["requestedRole"]) || "contributor",
      status: (row.status as AccessRequest["status"]) || "pending",
      requestedAt: new Date(row.requested_at as string),
      reviewedAt: row.reviewed_at
        ? new Date(row.reviewed_at as string)
        : undefined,
      reviewedBy: row.reviewed_by as string | undefined,
      expiresAt: row.expires_at
        ? new Date(row.expires_at as string)
        : undefined,
      denialReason: row.denial_reason as string | undefined,
      metadata: JSON.parse((row.metadata as string) || "{}"),
    };
  }
}

// Export types for use in routes
export type {
  Project,
  Task,
  AgentProfile,
  AccessRequest,
  OnboardingConfig,
  CostEvent,
  TaskFilters,
  AccessRequestFilters,
};
