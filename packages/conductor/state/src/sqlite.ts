import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type {
  Task,
  TaskFilters,
  AgentProfile,
  Project,
  FileConflict,
  FileLock,
  CostEvent,
  AgentStatus,
  AccessRequest,
  AccessRequestStatus,
  AccessRequestFilters,
  ProjectContext,
  ProjectOnboardingConfig,
  AgentCheckpoint,
  CheckpointType,
  Bead,
  Convoy,
} from "@conductor/core";
import { BeadSchema, ConvoySchema } from "@conductor/core";

export interface StateStoreOptions {
  dbPath: string;
  verbose?: boolean;
}

/**
 * SQLite-based state store for Conductor
 */
export class SQLiteStateStore {
  private db: Database.Database;
  private currentProjectId: string | null = null;

  constructor(options: StateStoreOptions | string) {
    const dbPath = typeof options === "string" ? options : options.dbPath;
    const verbose = typeof options === "object" && options.verbose;

    this.db = new Database(dbPath, {
      verbose: verbose ? console.log : undefined,
    });
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      -- Projects table
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        root_path TEXT,
        git_remote TEXT,
        git_branch TEXT DEFAULT 'main',
        conflict_strategy TEXT DEFAULT 'lock',
        settings TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        budget_total REAL,
        budget_spent REAL DEFAULT 0,
        budget_alert_threshold REAL DEFAULT 80,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Agents table
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'custom',
        model TEXT,
        status TEXT DEFAULT 'idle',
        capabilities TEXT, -- JSON array
        cost_input REAL DEFAULT 0,
        cost_output REAL DEFAULT 0,
        quota_limit INTEGER,
        quota_used INTEGER DEFAULT 0,
        quota_reset_at TEXT,
        last_heartbeat TEXT,
        metadata TEXT DEFAULT '{}', -- JSON object
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        assigned_to TEXT,
        claimed_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        dependencies TEXT DEFAULT '[]', -- JSON array
        blocked_by TEXT, -- JSON array
        estimated_tokens INTEGER,
        actual_tokens INTEGER,
        files TEXT DEFAULT '[]', -- JSON array
        tags TEXT DEFAULT '[]', -- JSON array
        metadata TEXT DEFAULT '{}', -- JSON object
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES agents(id) ON DELETE SET NULL
      );

      -- File locks table
      CREATE TABLE IF NOT EXISTS file_locks (
        file_path TEXT NOT NULL,
        project_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        locked_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT,
        PRIMARY KEY (file_path, project_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      );

      -- Conflicts table
      CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        agents TEXT NOT NULL, -- JSON array
        strategy TEXT NOT NULL,
        resolved_at TEXT,
        resolution TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- Cost events table
      CREATE TABLE IF NOT EXISTS cost_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        model TEXT NOT NULL,
        task_id TEXT,
        tokens_input INTEGER NOT NULL,
        tokens_output INTEGER NOT NULL,
        cost REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
      );

      -- Access requests table (Agent onboarding queue)
      CREATE TABLE IF NOT EXISTS access_requests (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        agent_type TEXT NOT NULL DEFAULT 'custom',
        capabilities TEXT DEFAULT '[]', -- JSON array
        requested_role TEXT DEFAULT 'contributor',
        status TEXT DEFAULT 'pending',
        requested_at TEXT DEFAULT (datetime('now')),
        reviewed_at TEXT,
        reviewed_by TEXT,
        expires_at TEXT,
        denial_reason TEXT,
        metadata TEXT DEFAULT '{}', -- JSON object
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- Project onboarding config table
      CREATE TABLE IF NOT EXISTS project_onboarding (
        project_id TEXT PRIMARY KEY,
        welcome_message TEXT,
        current_focus TEXT,
        goals TEXT DEFAULT '[]', -- JSON array
        style_guide TEXT,
        checkpoint_rules TEXT DEFAULT '[]', -- JSON array
        checkpoint_every_n_tasks INTEGER DEFAULT 3,
        auto_refresh_context INTEGER DEFAULT 1,
        agent_instructions TEXT DEFAULT '{}', -- JSON object: { claude: "...", gemini: "..." }
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- Agent task history (for tracking first task, checkpoint intervals)
      CREATE TABLE IF NOT EXISTS agent_task_history (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        claimed_at TEXT DEFAULT (datetime('now')),
        context_injected INTEGER DEFAULT 1, -- Was context bundle sent?
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      -- Agent checkpoints table (context rollover)
      CREATE TABLE IF NOT EXISTS agent_checkpoints (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        task_id TEXT,
        bead_id TEXT,
        checkpoint_type TEXT DEFAULT 'manual',
        stage TEXT NOT NULL,
        context TEXT DEFAULT '{}', -- JSON object
        metadata TEXT DEFAULT '{}', -- JSON object
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_checkpoints_task ON agent_checkpoints(task_id);
      CREATE INDEX IF NOT EXISTS idx_checkpoints_agent ON agent_checkpoints(agent_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_file_locks_project ON file_locks(project_id);
      CREATE INDEX IF NOT EXISTS idx_cost_events_project ON cost_events(project_id);
      CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id);
      CREATE INDEX IF NOT EXISTS idx_access_requests_project ON access_requests(project_id);
      CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
      CREATE INDEX IF NOT EXISTS idx_agent_task_history_agent ON agent_task_history(project_id, agent_id);
    `);
  }

  // ============================================================================
  // Project Methods
  // ============================================================================

  createProject(
    project: Omit<Project, "id" | "createdAt" | "updatedAt">,
  ): Project {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO projects (id, organization_id, name, slug, root_path, git_remote, git_branch, conflict_strategy, settings, is_active, budget_total, budget_spent, budget_alert_threshold, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        project.organizationId,
        project.name,
        project.slug,
        project.rootPath || null,
        project.gitRemote || null,
        project.gitBranch || "main",
        project.conflictStrategy || "lock",
        JSON.stringify(project.settings || {}),
        project.isActive !== false ? 1 : 0,
        project.budget?.total || null,
        project.budget?.spent || 0,
        project.budget?.alertThreshold || 80,
        now,
        now,
      );

    this.currentProjectId = id;
    return this.getProject(id)!;
  }

  getProject(projectId: string): Project | null {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(projectId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      id: row["id"] as string,
      organizationId: row["organization_id"] as string,
      name: row["name"] as string,
      slug: row["slug"] as string,
      rootPath: (row["root_path"] as string) || undefined,
      gitRemote: (row["git_remote"] as string) || undefined,
      gitBranch: (row["git_branch"] as string) || "main",
      conflictStrategy: row["conflict_strategy"] as Project["conflictStrategy"],
      settings: JSON.parse((row["settings"] as string) || "{}"),
      isActive: row["is_active"] === 1,
      budget: row["budget_total"]
        ? {
            total: row["budget_total"] as number,
            spent: row["budget_spent"] as number,
            currency: "USD",
            alertThreshold: row["budget_alert_threshold"] as number,
          }
        : undefined,
      createdAt: new Date(row["created_at"] as string),
      updatedAt: new Date(row["updated_at"] as string),
    };
  }

  setCurrentProject(projectId: string): void {
    this.currentProjectId = projectId;
  }

  getProjectId(): string {
    if (!this.currentProjectId) {
      throw new Error("No project selected. Call setCurrentProject() first.");
    }
    return this.currentProjectId;
  }

  // ============================================================================
  // Agent Methods
  // ============================================================================

  registerAgent(projectId: string, agent: AgentProfile): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO agents (id, project_id, name, provider, model, status, capabilities, cost_input, cost_output, quota_limit, quota_used, quota_reset_at, last_heartbeat, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        agent.id,
        projectId,
        agent.name,
        agent.provider || "custom",
        agent.model || null,
        agent.status || "idle",
        JSON.stringify(agent.capabilities),
        agent.costPerToken.input,
        agent.costPerToken.output,
        agent.quotaLimit || null,
        agent.quotaUsed || 0,
        agent.quotaResetAt?.toISOString() || null,
        agent.lastHeartbeat?.toISOString() || null,
        JSON.stringify(agent.metadata || {}),
      );
  }

  getAgent(agentId: string): AgentProfile | null {
    const row = this.db
      .prepare("SELECT * FROM agents WHERE id = ?")
      .get(agentId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.rowToAgent(row);
  }

  listAgents(projectId: string): AgentProfile[] {
    const rows = this.db
      .prepare("SELECT * FROM agents WHERE project_id = ?")
      .all(projectId) as Record<string, unknown>[];

    return rows.map((row) => this.rowToAgent(row));
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    this.db
      .prepare("UPDATE agents SET status = ?, last_heartbeat = ? WHERE id = ?")
      .run(status, new Date().toISOString(), agentId);
  }

  heartbeat(agentId: string): void {
    this.db
      .prepare("UPDATE agents SET last_heartbeat = ? WHERE id = ?")
      .run(new Date().toISOString(), agentId);
  }

  private rowToAgent(row: Record<string, unknown>): AgentProfile {
    return {
      id: row["id"] as string,
      name: row["name"] as string,
      provider: (row["provider"] as AgentProfile["provider"]) || "custom",
      model: (row["model"] as string) || (row["id"] as string),
      status: row["status"] as AgentStatus,
      capabilities: JSON.parse((row["capabilities"] as string) || "[]"),
      costPerToken: {
        input: row["cost_input"] as number,
        output: row["cost_output"] as number,
      },
      quotaLimit: (row["quota_limit"] as number) || undefined,
      quotaUsed: (row["quota_used"] as number) || undefined,
      quotaResetAt: row["quota_reset_at"]
        ? new Date(row["quota_reset_at"] as string)
        : undefined,
      lastHeartbeat: row["last_heartbeat"]
        ? new Date(row["last_heartbeat"] as string)
        : undefined,
      metadata: JSON.parse((row["metadata"] as string) || "{}"),
    };
  }

  // ============================================================================
  // Task Methods
  // ============================================================================

  createTask(
    projectId: string,
    task: Omit<Task, "id" | "projectId" | "createdAt" | "updatedAt">,
  ): Task {
    const id = crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, dependencies, files, tags, metadata, estimated_tokens)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        projectId,
        task.title,
        task.description || null,
        task.status || "pending",
        task.priority || "medium",
        task.assignedTo || null,
        JSON.stringify(task.dependencies || []),
        JSON.stringify(task.files || []),
        JSON.stringify(task.tags || []),
        JSON.stringify(task.metadata || {}),
        task.estimatedTokens || null,
      );

    return this.getTask(id)!;
  }

  getTask(taskId: string): Task | null {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.rowToTask(row);
  }

  updateTask(taskId: string, updates: Partial<Task>): Task {
    const current = this.getTask(taskId);
    if (!current) throw new Error(`Task not found: ${taskId}`);

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      setClauses.push("status = ?");
      values.push(updates.status);

      // Set timestamps based on status
      if (updates.status === "in_progress" && !current.startedAt) {
        setClauses.push("started_at = ?");
        values.push(new Date().toISOString());
      }
      if (updates.status === "completed" || updates.status === "failed") {
        setClauses.push("completed_at = ?");
        values.push(new Date().toISOString());
      }
    }

    if (updates.priority !== undefined) {
      setClauses.push("priority = ?");
      values.push(updates.priority);
    }

    if (updates.assignedTo !== undefined) {
      setClauses.push("assigned_to = ?");
      values.push(updates.assignedTo);
    }

    if (updates.actualTokens !== undefined) {
      setClauses.push("actual_tokens = ?");
      values.push(updates.actualTokens);
    }

    if (updates.metadata !== undefined) {
      setClauses.push("metadata = ?");
      values.push(JSON.stringify(updates.metadata));
    }

    if (updates.blockedBy !== undefined) {
      setClauses.push("blocked_by = ?");
      values.push(JSON.stringify(updates.blockedBy));
    }

    if (setClauses.length > 0) {
      values.push(taskId);
      this.db
        .prepare(`UPDATE tasks SET ${setClauses.join(", ")} WHERE id = ?`)
        .run(...values);
    }

    return this.getTask(taskId)!;
  }

  listTasks(projectId: string, filters?: TaskFilters): Task[] {
    let query = "SELECT * FROM tasks WHERE project_id = ?";
    const params: unknown[] = [projectId];

    if (filters?.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      query += ` AND status IN (${statuses.map(() => "?").join(", ")})`;
      params.push(...statuses);
    }

    if (filters?.priority) {
      const priorities = Array.isArray(filters.priority)
        ? filters.priority
        : [filters.priority];
      query += ` AND priority IN (${priorities.map(() => "?").join(", ")})`;
      params.push(...priorities);
    }

    if (filters?.assignedTo) {
      query += " AND assigned_to = ?";
      params.push(filters.assignedTo);
    }

    query +=
      " ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at";

    const rows = this.db.prepare(query).all(...params) as Record<
      string,
      unknown
    >[];
    return rows.map((row) => this.rowToTask(row));
  }

  claimTask(taskId: string, agentId: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE tasks SET assigned_to = ?, claimed_at = ?, status = 'claimed'
         WHERE id = ? AND (assigned_to IS NULL OR assigned_to = ?) AND status = 'pending'`,
      )
      .run(agentId, new Date().toISOString(), taskId, agentId);

    return result.changes > 0;
  }

  private rowToTask(row: Record<string, unknown>): Task {
    return {
      id: row["id"] as string,
      projectId: row["project_id"] as string,
      title: row["title"] as string,
      description: (row["description"] as string) || undefined,
      status: row["status"] as Task["status"],
      priority: row["priority"] as Task["priority"],
      assignedTo: (row["assigned_to"] as string) || undefined,
      claimedAt: row["claimed_at"]
        ? new Date(row["claimed_at"] as string)
        : undefined,
      startedAt: row["started_at"]
        ? new Date(row["started_at"] as string)
        : undefined,
      completedAt: row["completed_at"]
        ? new Date(row["completed_at"] as string)
        : undefined,
      dependencies: JSON.parse((row["dependencies"] as string) || "[]"),
      blockedBy: row["blocked_by"]
        ? JSON.parse(row["blocked_by"] as string)
        : undefined,
      estimatedTokens: (row["estimated_tokens"] as number) || undefined,
      actualTokens: (row["actual_tokens"] as number) || undefined,
      files: JSON.parse((row["files"] as string) || "[]"),
      tags: JSON.parse((row["tags"] as string) || "[]"),
      metadata: JSON.parse((row["metadata"] as string) || "{}"),
      createdAt: new Date(row["created_at"] as string),
      updatedAt: new Date(
        (row["updated_at"] as string) || (row["created_at"] as string),
      ),
    };
  }

  // ============================================================================
  // Lock Methods
  // ============================================================================

  acquireLock(
    projectId: string,
    filePath: string,
    agentId: string,
    ttlSeconds = 1800,
  ): boolean {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    // Clean up expired locks first
    this.db
      .prepare("DELETE FROM file_locks WHERE project_id = ? AND expires_at < ?")
      .run(projectId, now.toISOString());

    try {
      this.db
        .prepare(
          `INSERT INTO file_locks (file_path, project_id, agent_id, locked_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          filePath,
          projectId,
          agentId,
          now.toISOString(),
          expiresAt.toISOString(),
        );
      return true;
    } catch {
      // Lock already exists
      return false;
    }
  }

  releaseLock(projectId: string, filePath: string, agentId: string): void {
    this.db
      .prepare(
        "DELETE FROM file_locks WHERE project_id = ? AND file_path = ? AND agent_id = ?",
      )
      .run(projectId, filePath, agentId);
  }

  checkLock(
    projectId: string,
    filePath: string,
  ): { locked: boolean; holder?: string; expiresAt?: Date } {
    // Clean up expired locks
    this.db
      .prepare("DELETE FROM file_locks WHERE project_id = ? AND expires_at < ?")
      .run(projectId, new Date().toISOString());

    const row = this.db
      .prepare(
        "SELECT * FROM file_locks WHERE project_id = ? AND file_path = ?",
      )
      .get(projectId, filePath) as Record<string, unknown> | undefined;

    if (!row) {
      return { locked: false };
    }

    return {
      locked: true,
      holder: row["agent_id"] as string,
      expiresAt: new Date(row["expires_at"] as string),
    };
  }

  /**
   * Remove all expired locks for a project. Returns count of removed locks.
   */
  cleanupStaleLocks(projectId: string): number {
    const result = this.db
      .prepare("DELETE FROM file_locks WHERE project_id = ? AND expires_at < ?")
      .run(projectId, new Date().toISOString());
    return result.changes;
  }

  /**
   * List all active (non-expired) locks for a project.
   */
  listActiveLocks(
    projectId: string,
  ): Array<{ filePath: string; agentId: string; lockedAt: Date; expiresAt: Date }> {
    const now = new Date().toISOString();
    const rows = this.db
      .prepare(
        "SELECT * FROM file_locks WHERE project_id = ? AND expires_at >= ?",
      )
      .all(projectId, now) as Record<string, unknown>[];

    return rows.map((row) => ({
      filePath: row["file_path"] as string,
      agentId: row["agent_id"] as string,
      lockedAt: new Date(row["locked_at"] as string),
      expiresAt: new Date(row["expires_at"] as string),
    }));
  }

  /**
   * Get orphaned tasks: in_progress tasks whose assigned agent is offline.
   */
  getOrphanedTasks(projectId: string): Task[] {
    const rows = this.db
      .prepare(
        `SELECT t.* FROM tasks t
         JOIN agents a ON t.assigned_to = a.id
         WHERE t.project_id = ? AND t.status IN ('in_progress', 'claimed')
         AND a.status = 'offline'`,
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map((row) => this.rowToTask(row));
  }

  /**
   * Reassign a task to a new agent: updates assigned_to, releases old agent's locks,
   * and increments metadata.reassignmentCount.
   */
  reassignTask(
    taskId: string,
    newAgentId: string,
    projectId: string,
  ): Task {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const oldAgentId = task.assignedTo;
    const currentCount =
      (task.metadata?.["reassignmentCount"] as number) ?? 0;

    // Update the task assignment and metadata
    this.db
      .prepare(
        `UPDATE tasks SET assigned_to = ?, status = 'claimed', claimed_at = ?,
         metadata = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        newAgentId,
        new Date().toISOString(),
        JSON.stringify({
          ...task.metadata,
          reassignmentCount: currentCount + 1,
          lastReassignedFrom: oldAgentId,
          lastReassignedAt: new Date().toISOString(),
        }),
        new Date().toISOString(),
        taskId,
      );

    // Release old agent's locks for this project
    if (oldAgentId) {
      this.db
        .prepare(
          "DELETE FROM file_locks WHERE project_id = ? AND agent_id = ?",
        )
        .run(projectId, oldAgentId);
    }

    return this.getTask(taskId)!;
  }

  /**
   * Get the reassignment count for a task from its metadata.
   */
  getTaskReassignmentCount(taskId: string): number {
    const task = this.getTask(taskId);
    if (!task) return 0;
    return (task.metadata?.["reassignmentCount"] as number) ?? 0;
  }

  /**
   * Set zone configuration for a project (stored in projects.settings JSON).
   */
  setProjectZoneConfig(
    projectId: string,
    zoneConfig: Record<string, unknown>,
  ): void {
    const project = this.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const settings = { ...project.settings, zoneConfig };
    this.db
      .prepare("UPDATE projects SET settings = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(settings), new Date().toISOString(), projectId);
  }

  /**
   * Get zone configuration for a project from projects.settings JSON.
   */
  getProjectZoneConfig(
    projectId: string,
  ): Record<string, unknown> | null {
    const project = this.getProject(projectId);
    if (!project) return null;
    return (project.settings?.["zoneConfig"] as Record<string, unknown>) ?? null;
  }

  // ============================================================================
  // Cost Methods
  // ============================================================================

  recordCost(event: Omit<CostEvent, "id" | "createdAt">): void {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO cost_events (id, organization_id, project_id, agent_id, model, task_id, tokens_input, tokens_output, cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        event.organizationId,
        event.projectId,
        event.agentId,
        event.model,
        event.taskId || null,
        event.tokensInput,
        event.tokensOutput,
        event.cost,
      );

    // Update project budget spent
    this.db
      .prepare(
        "UPDATE projects SET budget_spent = budget_spent + ? WHERE id = ?",
      )
      .run(event.cost, event.projectId);
  }

  getProjectSpend(projectId: string): number {
    const row = this.db
      .prepare(
        "SELECT COALESCE(SUM(cost), 0) as total FROM cost_events WHERE project_id = ?",
      )
      .get(projectId) as { total: number };

    return row.total;
  }

  getAgentSpend(agentId: string): number {
    const row = this.db
      .prepare(
        "SELECT COALESCE(SUM(cost), 0) as total FROM cost_events WHERE agent_id = ?",
      )
      .get(agentId) as { total: number };

    return row.total;
  }

  getCostEvents(projectId: string): CostEvent[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM cost_events WHERE project_id = ? ORDER BY created_at DESC",
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row["id"] as string,
      organizationId: row["organization_id"] as string,
      projectId: row["project_id"] as string,
      agentId: row["agent_id"] as string,
      model: row["model"] as string,
      taskId: (row["task_id"] as string) || undefined,
      tokensInput: row["tokens_input"] as number,
      tokensOutput: row["tokens_output"] as number,
      cost: row["cost"] as number,
      createdAt: new Date(row["created_at"] as string),
    }));
  }

  // ============================================================================
  // Access Request Methods
  // ============================================================================

  /**
   * Create a new access request (agent requesting to join project)
   */
  createAccessRequest(
    projectId: string,
    request: {
      agentId: string;
      agentName: string;
      agentType: string;
      capabilities?: string[];
      requestedRole?: "lead" | "contributor" | "reviewer" | "observer";
      metadata?: Record<string, unknown>;
    },
  ): AccessRequest {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Check if there's already a pending request from this agent
    const existing = this.db
      .prepare(
        "SELECT id FROM access_requests WHERE project_id = ? AND agent_id = ? AND status = 'pending'",
      )
      .get(projectId, request.agentId) as { id: string } | undefined;

    if (existing) {
      return this.getAccessRequest(existing.id)!;
    }

    this.db
      .prepare(
        `INSERT INTO access_requests (id, project_id, agent_id, agent_name, agent_type, capabilities, requested_role, status, requested_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .run(
        id,
        projectId,
        request.agentId,
        request.agentName,
        request.agentType,
        JSON.stringify(request.capabilities || []),
        request.requestedRole || "contributor",
        now,
        JSON.stringify(request.metadata || {}),
      );

    return this.getAccessRequest(id)!;
  }

  /**
   * Get a single access request by ID
   */
  getAccessRequest(requestId: string): AccessRequest | null {
    const row = this.db
      .prepare("SELECT * FROM access_requests WHERE id = ?")
      .get(requestId) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToAccessRequest(row);
  }

  /**
   * List access requests for a project
   */
  listAccessRequests(
    projectId: string,
    filters?: AccessRequestFilters,
  ): AccessRequest[] {
    let query = "SELECT * FROM access_requests WHERE project_id = ?";
    const params: unknown[] = [projectId];

    if (filters?.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      query += ` AND status IN (${statuses.map(() => "?").join(", ")})`;
      params.push(...statuses);
    }

    if (filters?.agentType) {
      query += " AND agent_type = ?";
      params.push(filters.agentType);
    }

    query += " ORDER BY requested_at DESC";

    const rows = this.db.prepare(query).all(...params) as Record<
      string,
      unknown
    >[];
    return rows.map((row) => this.rowToAccessRequest(row));
  }

  /**
   * Approve an access request
   */
  approveAccessRequest(
    requestId: string,
    reviewedBy: string,
    expiresInDays?: number,
  ): AccessRequest {
    const now = new Date();
    const expiresAt = expiresInDays
      ? new Date(
          now.getTime() + expiresInDays * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;

    this.db
      .prepare(
        `UPDATE access_requests
         SET status = 'approved', reviewed_at = ?, reviewed_by = ?, expires_at = ?
         WHERE id = ?`,
      )
      .run(now.toISOString(), reviewedBy, expiresAt, requestId);

    const request = this.getAccessRequest(requestId)!;

    // Auto-register the agent in the project if not already registered
    const existingAgent = this.db
      .prepare("SELECT id FROM agents WHERE id = ? AND project_id = ?")
      .get(request.agentId, request.projectId);

    if (!existingAgent) {
      this.registerAgent(request.projectId, {
        id: request.agentId,
        name: request.agentName,
        provider: this.agentTypeToProvider(request.agentType),
        model: request.agentType,
        capabilities: request.capabilities,
        costPerToken: { input: 0, output: 0 },
        status: "idle",
        metadata: request.metadata,
      });
    }

    return request;
  }

  /**
   * Deny an access request
   */
  denyAccessRequest(
    requestId: string,
    reviewedBy: string,
    reason?: string,
  ): AccessRequest {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE access_requests
         SET status = 'denied', reviewed_at = ?, reviewed_by = ?, denial_reason = ?
         WHERE id = ?`,
      )
      .run(now, reviewedBy, reason || null, requestId);

    return this.getAccessRequest(requestId)!;
  }

  /**
   * Check if an agent has approved access to a project
   */
  hasApprovedAccess(projectId: string, agentId: string): boolean {
    const now = new Date().toISOString();

    const row = this.db
      .prepare(
        `SELECT id FROM access_requests
         WHERE project_id = ? AND agent_id = ? AND status = 'approved'
         AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .get(projectId, agentId, now);

    return !!row;
  }

  /**
   * Get pending access request count for a project
   */
  getPendingAccessCount(projectId: string): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM access_requests WHERE project_id = ? AND status = 'pending'",
      )
      .get(projectId) as { count: number };

    return row.count;
  }

  /**
   * Expire old pending requests
   */
  expireOldRequests(projectId: string, olderThanHours = 24): number {
    const cutoff = new Date(
      Date.now() - olderThanHours * 60 * 60 * 1000,
    ).toISOString();

    const result = this.db
      .prepare(
        `UPDATE access_requests
         SET status = 'expired'
         WHERE project_id = ? AND status = 'pending' AND requested_at < ?`,
      )
      .run(projectId, cutoff);

    return result.changes;
  }

  private rowToAccessRequest(row: Record<string, unknown>): AccessRequest {
    return {
      id: row["id"] as string,
      projectId: row["project_id"] as string,
      agentId: row["agent_id"] as string,
      agentName: row["agent_name"] as string,
      agentType: row["agent_type"] as AccessRequest["agentType"],
      capabilities: JSON.parse((row["capabilities"] as string) || "[]"),
      requestedRole: row["requested_role"] as AccessRequest["requestedRole"],
      status: row["status"] as AccessRequestStatus,
      requestedAt: new Date(row["requested_at"] as string),
      reviewedAt: row["reviewed_at"]
        ? new Date(row["reviewed_at"] as string)
        : undefined,
      reviewedBy: (row["reviewed_by"] as string) || undefined,
      expiresAt: row["expires_at"]
        ? new Date(row["expires_at"] as string)
        : undefined,
      denialReason: (row["denial_reason"] as string) || undefined,
      metadata: JSON.parse((row["metadata"] as string) || "{}"),
    };
  }

  private agentTypeToProvider(agentType: string): AgentProfile["provider"] {
    switch (agentType) {
      case "claude":
        return "anthropic";
      case "gemini":
        return "google";
      case "gpt4":
      case "codex":
        return "openai";
      case "llama":
        return "meta";
      default:
        return "custom";
    }
  }

  // ============================================================================
  // Project Context Methods (Onboarding & Drift Prevention)
  // ============================================================================

  /**
   * Set or update project onboarding configuration
   */
  setOnboardingConfig(
    projectId: string,
    config: Partial<ProjectOnboardingConfig>,
  ): void {
    const existing = this.getOnboardingConfig(projectId);

    if (existing) {
      const updates: string[] = [];
      const values: unknown[] = [];

      if (config.welcomeMessage !== undefined) {
        updates.push("welcome_message = ?");
        values.push(config.welcomeMessage);
      }
      if (config.currentFocus !== undefined) {
        updates.push("current_focus = ?");
        values.push(config.currentFocus);
      }
      if (config.goals !== undefined) {
        updates.push("goals = ?");
        values.push(JSON.stringify(config.goals));
      }
      if (config.styleGuide !== undefined) {
        updates.push("style_guide = ?");
        values.push(config.styleGuide);
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

      this.db
        .prepare(
          `UPDATE project_onboarding SET ${updates.join(", ")} WHERE project_id = ?`,
        )
        .run(...values);
    } else {
      this.db
        .prepare(
          `INSERT INTO project_onboarding (project_id, welcome_message, current_focus, goals, style_guide, checkpoint_rules, checkpoint_every_n_tasks, auto_refresh_context, agent_instructions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          projectId,
          config.welcomeMessage || null,
          config.currentFocus || null,
          JSON.stringify(config.goals || []),
          config.styleGuide || null,
          JSON.stringify(config.checkpointRules || []),
          config.checkpointEveryNTasks || 3,
          config.autoRefreshContext !== false ? 1 : 0,
          JSON.stringify(config.agentInstructionsFiles || {}),
        );
    }
  }

  /**
   * Get project onboarding configuration
   */
  getOnboardingConfig(projectId: string): ProjectOnboardingConfig | null {
    const row = this.db
      .prepare("SELECT * FROM project_onboarding WHERE project_id = ?")
      .get(projectId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      welcomeMessage: (row["welcome_message"] as string) || undefined,
      currentFocus: (row["current_focus"] as string) || undefined,
      goals: JSON.parse((row["goals"] as string) || "[]"),
      styleGuide: (row["style_guide"] as string) || undefined,
      checkpointRules: JSON.parse((row["checkpoint_rules"] as string) || "[]"),
      checkpointEveryNTasks: (row["checkpoint_every_n_tasks"] as number) || 3,
      autoRefreshContext: row["auto_refresh_context"] === 1,
      agentInstructionsFiles: JSON.parse(
        (row["agent_instructions"] as string) || "{}",
      ),
    };
  }

  /**
   * Record that an agent claimed a task (for tracking first task, checkpoints)
   */
  recordTaskClaim(projectId: string, agentId: string, taskId: string): void {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO agent_task_history (id, project_id, agent_id, task_id)
         VALUES (?, ?, ?, ?)`,
      )
      .run(id, projectId, agentId, taskId);
  }

  /**
   * Get count of tasks claimed by an agent in a project
   */
  getAgentTaskCount(projectId: string, agentId: string): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM agent_task_history WHERE project_id = ? AND agent_id = ?",
      )
      .get(projectId, agentId) as { count: number };

    return row.count;
  }

  /**
   * Check if this is the agent's first task in the project
   */
  isFirstTaskForAgent(projectId: string, agentId: string): boolean {
    return this.getAgentTaskCount(projectId, agentId) === 0;
  }

  /**
   * Check if agent should receive a context refresh (based on checkpoint interval)
   */
  shouldRefreshContext(projectId: string, agentId: string): boolean {
    const config = this.getOnboardingConfig(projectId);
    if (!config || !config.autoRefreshContext) return false;

    const taskCount = this.getAgentTaskCount(projectId, agentId);
    return taskCount > 0 && taskCount % config.checkpointEveryNTasks === 0;
  }

  /**
   * Generate a context bundle for an agent claiming a task
   */
  generateContextBundle(
    projectId: string,
    agentId: string,
    agentType: string,
    task: Task,
  ): ProjectContext {
    const project = this.getProject(projectId);
    const config = this.getOnboardingConfig(projectId);
    const isFirstTask = this.isFirstTaskForAgent(projectId, agentId);
    const accessRequest = this.listAccessRequests(projectId, {
      status: "approved",
    }).find((r) => r.agentId === agentId);

    // Build agent instructions from config
    let agentInstructions: string | undefined;
    if (config?.agentInstructionsFiles?.[agentType]) {
      agentInstructions = config.agentInstructionsFiles[agentType];
    }

    // Add welcome message for first task
    if (isFirstTask && config?.welcomeMessage) {
      agentInstructions = `${config.welcomeMessage}\n\n${agentInstructions || ""}`;
    }

    // Get related tasks (dependencies and tasks assigned to same files)
    const relatedTasks: string[] = [...(task.dependencies || [])];
    if (task.files && task.files.length > 0) {
      const allTasks = this.listTasks(projectId, {
        status: ["in_progress", "claimed"],
      });
      for (const t of allTasks) {
        if (t.id !== task.id && t.files?.some((f) => task.files?.includes(f))) {
          relatedTasks.push(t.id);
        }
      }
    }

    return {
      projectId,
      projectName: project?.name || "Unknown Project",
      currentFocus: config?.currentFocus,
      projectGoals: config?.goals || [],
      agentInstructions,
      styleGuide: config?.styleGuide,
      relevantPatterns: [], // Could be populated from project config
      allowedPaths: accessRequest
        ? JSON.parse(
            JSON.stringify(accessRequest.metadata?.["allowedPaths"] || []),
          )
        : [],
      deniedPaths: accessRequest
        ? JSON.parse(
            JSON.stringify(accessRequest.metadata?.["deniedPaths"] || []),
          )
        : [],
      checkpointRules: config?.checkpointRules || [],
      taskContext: {
        taskId: task.id,
        taskTitle: task.title,
        taskDescription: task.description,
        expectedFiles: task.files || [],
        relatedTasks: [...new Set(relatedTasks)],
      },
      generatedAt: new Date(),
      isFirstTask,
    };
  }

  /**
   * Generate a context refresh (without task-specific context)
   */
  generateContextRefresh(
    projectId: string,
    agentId: string,
    agentType: string,
  ): ProjectContext {
    const project = this.getProject(projectId);
    const config = this.getOnboardingConfig(projectId);
    const accessRequest = this.listAccessRequests(projectId, {
      status: "approved",
    }).find((r) => r.agentId === agentId);

    let agentInstructions: string | undefined;
    if (config?.agentInstructionsFiles?.[agentType]) {
      agentInstructions = config.agentInstructionsFiles[agentType];
    }

    return {
      projectId,
      projectName: project?.name || "Unknown Project",
      currentFocus: config?.currentFocus,
      projectGoals: config?.goals || [],
      agentInstructions,
      styleGuide: config?.styleGuide,
      relevantPatterns: [],
      allowedPaths: accessRequest
        ? JSON.parse(
            JSON.stringify(accessRequest.metadata?.["allowedPaths"] || []),
          )
        : [],
      deniedPaths: accessRequest
        ? JSON.parse(
            JSON.stringify(accessRequest.metadata?.["deniedPaths"] || []),
          )
        : [],
      checkpointRules: config?.checkpointRules || [],
      generatedAt: new Date(),
      isFirstTask: false,
    };
  }

  // ============================================================================
  // Checkpoint Methods (Context Rollover)
  // ============================================================================

  saveCheckpoint(
    checkpoint: Omit<AgentCheckpoint, "id" | "createdAt">,
  ): AgentCheckpoint {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO agent_checkpoints (id, project_id, agent_id, task_id, bead_id, checkpoint_type, stage, context, metadata, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        checkpoint.projectId,
        checkpoint.agentId,
        checkpoint.taskId || null,
        checkpoint.beadId || null,
        checkpoint.checkpointType || "manual",
        checkpoint.stage,
        JSON.stringify(checkpoint.context || {}),
        JSON.stringify(checkpoint.metadata || {}),
        now,
        checkpoint.expiresAt?.toISOString() || null,
      );

    return this.getCheckpoint(id)!;
  }

  getCheckpoint(checkpointId: string): AgentCheckpoint | null {
    const row = this.db
      .prepare("SELECT * FROM agent_checkpoints WHERE id = ?")
      .get(checkpointId) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToCheckpoint(row);
  }

  getLatestCheckpoint(taskId: string): AgentCheckpoint | null {
    const row = this.db
      .prepare(
        "SELECT * FROM agent_checkpoints WHERE task_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
      )
      .get(taskId) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToCheckpoint(row);
  }

  listCheckpoints(
    projectId: string,
    filters?: { agentId?: string; taskId?: string },
  ): AgentCheckpoint[] {
    let query = "SELECT * FROM agent_checkpoints WHERE project_id = ?";
    const params: unknown[] = [projectId];

    if (filters?.agentId) {
      query += " AND agent_id = ?";
      params.push(filters.agentId);
    }

    if (filters?.taskId) {
      query += " AND task_id = ?";
      params.push(filters.taskId);
    }

    query += " ORDER BY created_at DESC";

    const rows = this.db.prepare(query).all(...params) as Record<
      string,
      unknown
    >[];
    return rows.map((row) => this.rowToCheckpoint(row));
  }

  deleteExpiredCheckpoints(): number {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        "DELETE FROM agent_checkpoints WHERE expires_at IS NOT NULL AND expires_at < ?",
      )
      .run(now);
    return result.changes;
  }

  private rowToCheckpoint(row: Record<string, unknown>): AgentCheckpoint {
    return {
      id: row["id"] as string,
      projectId: row["project_id"] as string,
      agentId: row["agent_id"] as string,
      taskId: (row["task_id"] as string) || undefined,
      beadId: (row["bead_id"] as string) || undefined,
      checkpointType: (row["checkpoint_type"] as CheckpointType) || "manual",
      stage: row["stage"] as string,
      context: JSON.parse((row["context"] as string) || "{}"),
      metadata: JSON.parse((row["metadata"] as string) || "{}"),
      createdAt: new Date(row["created_at"] as string),
      expiresAt: row["expires_at"]
        ? new Date(row["expires_at"] as string)
        : undefined,
    };
  }

  // ============================================================================
  // Bead Import Methods (Gastown Integration)
  // ============================================================================

  importBeadsFromDirectory(
    projectId: string,
    beadDir: string,
    convoyDir?: string,
  ): { imported: number; skipped: number; errors: string[] } {
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    // Import beads
    if (!fs.existsSync(beadDir)) {
      result.errors.push(`Bead directory not found: ${beadDir}`);
      return result;
    }

    const beadFiles = fs
      .readdirSync(beadDir)
      .filter((f: string) => f.endsWith(".json"));

    for (const file of beadFiles) {
      try {
        const filePath = path.join(beadDir, file);
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const bead = BeadSchema.parse(raw);

        // Check if already imported
        const existing = this.db
          .prepare(
            "SELECT id FROM tasks WHERE project_id = ? AND json_extract(metadata, '$.bead_id') = ?",
          )
          .get(projectId, bead.id);

        if (existing) {
          result.skipped++;
          continue;
        }

        // Map bead to task
        const taskStatus =
          bead.status === "complete"
            ? "completed"
            : bead.status === "in_progress"
              ? "in_progress"
              : bead.status === "blocked"
                ? "blocked"
                : "pending";

        const taskPriority = bead.priority || "medium";

        // Resolve dependencies: map bead IDs to task IDs
        const depTaskIds: string[] = [];
        for (const depBeadId of bead.dependencies || []) {
          const depRow = this.db
            .prepare(
              "SELECT id FROM tasks WHERE project_id = ? AND json_extract(metadata, '$.bead_id') = ?",
            )
            .get(projectId, depBeadId) as { id: string } | undefined;
          if (depRow) {
            depTaskIds.push(depRow.id);
          }
        }

        this.createTask(projectId, {
          title: bead.title,
          description: (bead.acceptance_criteria || []).join("\n"),
          status: taskStatus as Task["status"],
          priority: taskPriority as Task["priority"],
          dependencies: depTaskIds,
          files: (bead.metadata?.["files_likely_touched"] as string[]) || [],
          tags: (bead.metadata?.["skills_required"] as string[]) || [],
          metadata: {
            bead_id: bead.id,
            bead_type: bead.type,
            bead_complexity: bead.complexity,
            evidence: bead.evidence,
            ...bead.metadata,
          },
        });

        result.imported++;
      } catch (err) {
        result.errors.push(
          `${file}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Import convoys as task groups (metadata)
    if (convoyDir && fs.existsSync(convoyDir)) {
      const convoyFiles = fs
        .readdirSync(convoyDir)
        .filter((f: string) => f.endsWith(".json"));

      for (const file of convoyFiles) {
        try {
          const filePath = path.join(convoyDir, file);
          const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          const convoy = ConvoySchema.parse(raw);

          // Tag tasks that belong to this convoy
          for (const beadId of convoy.beads || []) {
            const taskRow = this.db
              .prepare(
                "SELECT id, metadata FROM tasks WHERE project_id = ? AND json_extract(metadata, '$.bead_id') = ?",
              )
              .get(projectId, beadId) as
              | { id: string; metadata: string }
              | undefined;

            if (taskRow) {
              const metadata = JSON.parse(taskRow.metadata || "{}");
              metadata.convoy_id = convoy.id;
              metadata.convoy_name = convoy.name;
              this.db
                .prepare("UPDATE tasks SET metadata = ? WHERE id = ?")
                .run(JSON.stringify(metadata), taskRow.id);
            }
          }
        } catch (err) {
          result.errors.push(
            `convoy ${file}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    return result;
  }

  syncBeadToFile(beadId: string, beadPath: string): boolean {
    // Find the task with this bead_id
    const taskRow = this.db
      .prepare(
        "SELECT status FROM tasks WHERE json_extract(metadata, '$.bead_id') = ?",
      )
      .get(beadId) as { status: string } | undefined;

    if (!taskRow) return false;

    try {
      const raw = JSON.parse(fs.readFileSync(beadPath, "utf-8"));

      // Map task status back to bead status
      const beadStatus =
        taskRow.status === "completed"
          ? "complete"
          : taskRow.status === "in_progress" || taskRow.status === "claimed"
            ? "in_progress"
            : taskRow.status === "blocked"
              ? "blocked"
              : "pending";

      raw.status = beadStatus;
      fs.writeFileSync(beadPath, JSON.stringify(raw, null, 2) + "\n");
      return true;
    } catch {
      return false;
    }
  }

  updateBeadStatus(taskId: string): { beadId: string; status: string } | null {
    const task = this.getTask(taskId);
    if (!task) return null;

    const beadId = task.metadata?.["bead_id"] as string | undefined;
    if (!beadId) return null;

    const beadStatus =
      task.status === "completed"
        ? "complete"
        : task.status === "in_progress" || task.status === "claimed"
          ? "in_progress"
          : task.status === "blocked"
            ? "blocked"
            : "pending";

    return { beadId, status: beadStatus };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  close(): void {
    this.db.close();
  }

  /**
   * Run operations in a transaction
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
