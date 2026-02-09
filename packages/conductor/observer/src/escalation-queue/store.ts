import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Escalation, ActionLog, DetectionEvent } from '../types.js';

export interface CreateEscalationInput {
  projectId: string;
  priority: 'critical' | 'high' | 'normal';
  type: string;
  title: string;
  agentId?: string;
  taskId?: string;
  detectionEvent: DetectionEvent;
  consoleOutput: string;
  attemptedActions: ActionLog[];
  suggestedAction?: string;
  expiresAt?: Date;
}

export interface UpdateEscalationInput {
  status?: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
}

export interface ListEscalationsOptions {
  status?: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  priority?: 'critical' | 'high' | 'normal';
}

export interface StatusCounts {
  pending: number;
  acknowledged: number;
  resolved: number;
  dismissed: number;
}

/**
 * EscalationStore - Persists escalations to SQLite using better-sqlite3
 */
export class EscalationStore {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Initialize the database schema
   */
  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS escalations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        priority TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        agent_id TEXT,
        task_id TEXT,
        detection_event TEXT NOT NULL,
        console_output TEXT NOT NULL,
        attempted_actions TEXT NOT NULL,
        suggested_action TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        resolved_by TEXT,
        resolved_at TEXT,
        resolution TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_escalations_project_id
        ON escalations(project_id);

      CREATE INDEX IF NOT EXISTS idx_escalations_status
        ON escalations(status);

      CREATE INDEX IF NOT EXISTS idx_escalations_priority
        ON escalations(priority);

      CREATE INDEX IF NOT EXISTS idx_escalations_agent_id
        ON escalations(agent_id);
    `);
  }

  /**
   * Create a new escalation
   */
  createEscalation(input: CreateEscalationInput): Escalation {
    const id = `esc-${randomUUID()}`;
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO escalations (
        id,
        project_id,
        priority,
        type,
        title,
        agent_id,
        task_id,
        detection_event,
        console_output,
        attempted_actions,
        suggested_action,
        status,
        created_at,
        expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.projectId,
      input.priority,
      input.type,
      input.title,
      input.agentId ?? null,
      input.taskId ?? null,
      JSON.stringify(input.detectionEvent),
      input.consoleOutput,
      JSON.stringify(input.attemptedActions),
      input.suggestedAction ?? null,
      'pending',
      now.toISOString(),
      input.expiresAt?.toISOString() ?? null
    );

    return {
      id,
      projectId: input.projectId,
      priority: input.priority,
      type: input.type,
      title: input.title,
      agentId: input.agentId,
      taskId: input.taskId,
      detectionEvent: input.detectionEvent,
      consoleOutput: input.consoleOutput,
      attemptedActions: input.attemptedActions,
      suggestedAction: input.suggestedAction,
      status: 'pending',
      createdAt: now,
      expiresAt: input.expiresAt,
    };
  }

  /**
   * Get a single escalation by ID
   */
  getEscalation(id: string): Escalation | undefined {
    const stmt = this.db.prepare('SELECT * FROM escalations WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) {
      return undefined;
    }

    return this.rowToEscalation(row);
  }

  /**
   * List escalations for a project with optional filters
   */
  listEscalations(
    projectId: string,
    options?: ListEscalationsOptions
  ): Escalation[] {
    let sql = `
      SELECT * FROM escalations
      WHERE project_id = ?
    `;

    const params: any[] = [projectId];

    if (options?.status) {
      sql += ` AND status = ?`;
      params.push(options.status);
    }

    if (options?.priority) {
      sql += ` AND priority = ?`;
      params.push(options.priority);
    }

    // Order by priority (critical > high > normal) then by createdAt
    sql += `
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
        END,
        created_at ASC
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => this.rowToEscalation(row));
  }

  /**
   * Update an escalation
   */
  updateEscalation(id: string, update: UpdateEscalationInput): void {
    const updates: string[] = [];
    const values: any[] = [];

    if (update.status !== undefined) {
      updates.push('status = ?');
      values.push(update.status);
    }

    if (update.resolvedBy !== undefined) {
      updates.push('resolved_by = ?');
      values.push(update.resolvedBy);
    }

    if (update.resolvedAt !== undefined) {
      updates.push('resolved_at = ?');
      values.push(update.resolvedAt.toISOString());
    }

    if (update.resolution !== undefined) {
      updates.push('resolution = ?');
      values.push(update.resolution);
    }

    if (updates.length === 0) {
      return;
    }

    values.push(id);

    const sql = `UPDATE escalations SET ${updates.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);
  }

  /**
   * Delete an escalation by ID
   */
  deleteEscalation(id: string): void {
    const stmt = this.db.prepare('DELETE FROM escalations WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Count escalations by status for a project
   */
  countByStatus(projectId: string): StatusCounts {
    const stmt = this.db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM escalations
      WHERE project_id = ?
      GROUP BY status
    `);

    const rows = stmt.all(projectId) as any[];

    const counts: StatusCounts = {
      pending: 0,
      acknowledged: 0,
      resolved: 0,
      dismissed: 0,
    };

    for (const row of rows) {
      counts[row.status as keyof StatusCounts] = row.count;
    }

    return counts;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Convert database row to Escalation object
   */
  private rowToEscalation(row: any): Escalation {
    return {
      id: row.id,
      projectId: row.project_id,
      priority: row.priority as 'critical' | 'high' | 'normal',
      type: row.type,
      title: row.title,
      agentId: row.agent_id ?? undefined,
      taskId: row.task_id ?? undefined,
      detectionEvent: JSON.parse(row.detection_event),
      consoleOutput: row.console_output,
      attemptedActions: JSON.parse(row.attempted_actions),
      suggestedAction: row.suggested_action ?? undefined,
      status: row.status as 'pending' | 'acknowledged' | 'resolved' | 'dismissed',
      resolvedBy: row.resolved_by ?? undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolution: row.resolution ?? undefined,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    };
  }
}
