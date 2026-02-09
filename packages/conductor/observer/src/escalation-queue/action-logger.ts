import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { ActionLog, AutonomousAction, DetectionEvent } from '../types.js';

export interface LogActionInput {
  projectId: string;
  observerId: string;
  action: AutonomousAction;
  triggerEvent: DetectionEvent;
}

export interface ListActionsOptions {
  outcome?: 'success' | 'failure' | 'pending';
}

/**
 * ActionLogger - Records autonomous actions for audit trail in SQLite using better-sqlite3
 */
export class ActionLogger {
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
      CREATE TABLE IF NOT EXISTS observer_actions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        observer_id TEXT NOT NULL,
        action TEXT NOT NULL,
        trigger_event TEXT NOT NULL,
        outcome TEXT NOT NULL DEFAULT 'pending',
        outcome_details TEXT,
        human_override TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_observer_actions_project_id
        ON observer_actions(project_id);

      CREATE INDEX IF NOT EXISTS idx_observer_actions_outcome
        ON observer_actions(outcome);

      CREATE INDEX IF NOT EXISTS idx_observer_actions_created_at
        ON observer_actions(created_at);
    `);
  }

  /**
   * Create an action log with generated ID
   */
  logAction(input: LogActionInput): ActionLog {
    const id = `act-${randomUUID()}`;
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO observer_actions (
        id,
        project_id,
        observer_id,
        action,
        trigger_event,
        outcome,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.projectId,
      input.observerId,
      JSON.stringify(input.action),
      JSON.stringify(input.triggerEvent),
      'pending',
      now.toISOString()
    );

    return {
      id,
      projectId: input.projectId,
      observerId: input.observerId,
      action: input.action,
      triggerEvent: input.triggerEvent,
      outcome: 'pending',
      createdAt: now,
    };
  }

  /**
   * Get a single action log by ID
   */
  getAction(id: string): ActionLog | undefined {
    const stmt = this.db.prepare('SELECT * FROM observer_actions WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) {
      return undefined;
    }

    return this.rowToActionLog(row);
  }

  /**
   * Update outcome to 'success' or 'failure'
   */
  updateOutcome(
    id: string,
    outcome: 'success' | 'failure',
    details?: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE observer_actions
      SET outcome = ?, outcome_details = ?
      WHERE id = ?
    `);

    stmt.run(outcome, details ?? null, id);
  }

  /**
   * Record human override
   */
  recordOverride(
    id: string,
    override: {
      overriddenBy: string;
      overrideAction: string;
      reason?: string;
    }
  ): void {
    const stmt = this.db.prepare(`
      UPDATE observer_actions
      SET human_override = ?
      WHERE id = ?
    `);

    stmt.run(JSON.stringify(override), id);
  }

  /**
   * List actions for a project with optional outcome filter, ordered by createdAt DESC
   */
  listActions(
    projectId: string,
    options?: ListActionsOptions
  ): ActionLog[] {
    let sql = `
      SELECT * FROM observer_actions
      WHERE project_id = ?
    `;

    const params: any[] = [projectId];

    if (options?.outcome) {
      sql += ` AND outcome = ?`;
      params.push(options.outcome);
    }

    sql += ` ORDER BY created_at DESC`;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => this.rowToActionLog(row));
  }

  /**
   * Get actions by agent using JSON extraction from trigger_event
   */
  getActionsByAgent(projectId: string, agentId: string): ActionLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM observer_actions
      WHERE project_id = ? AND json_extract(trigger_event, '$.agentId') = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(projectId, agentId) as any[];

    return rows.map((row) => this.rowToActionLog(row));
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Convert database row to ActionLog object
   */
  private rowToActionLog(row: any): ActionLog {
    return {
      id: row.id,
      projectId: row.project_id,
      observerId: row.observer_id,
      action: JSON.parse(row.action),
      triggerEvent: JSON.parse(row.trigger_event),
      outcome: row.outcome as 'success' | 'failure' | 'pending',
      outcomeDetails: row.outcome_details ?? undefined,
      humanOverride: row.human_override ? JSON.parse(row.human_override) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}
