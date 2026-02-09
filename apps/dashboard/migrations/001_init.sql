-- Conductor D1 Database Schema
-- Migration: 001_init
-- Description: Initial database schema for Conductor orchestration

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
  capabilities TEXT,
  cost_input REAL DEFAULT 0,
  cost_output REAL DEFAULT 0,
  quota_limit INTEGER,
  quota_used INTEGER DEFAULT 0,
  quota_reset_at TEXT,
  last_heartbeat TEXT,
  metadata TEXT DEFAULT '{}',
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
  dependencies TEXT DEFAULT '[]',
  blocked_by TEXT,
  estimated_tokens INTEGER,
  actual_tokens INTEGER,
  files TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  metadata TEXT DEFAULT '{}',
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
  agents TEXT NOT NULL,
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
  capabilities TEXT DEFAULT '[]',
  requested_role TEXT DEFAULT 'contributor',
  status TEXT DEFAULT 'pending',
  requested_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT,
  expires_at TEXT,
  denial_reason TEXT,
  metadata TEXT DEFAULT '{}',
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Project onboarding config table
CREATE TABLE IF NOT EXISTS project_onboarding (
  project_id TEXT PRIMARY KEY,
  welcome_message TEXT,
  current_focus TEXT,
  goals TEXT DEFAULT '[]',
  style_guide TEXT,
  checkpoint_rules TEXT DEFAULT '[]',
  checkpoint_every_n_tasks INTEGER DEFAULT 3,
  auto_refresh_context INTEGER DEFAULT 1,
  agent_instructions TEXT DEFAULT '{}',
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
  context_injected INTEGER DEFAULT 1,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_file_locks_project ON file_locks(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_project ON cost_events(project_id);
CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_project ON access_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_agent_task_history_agent ON agent_task_history(project_id, agent_id);
