-- =============================================================================
-- Migration: 0001_enable_rls.sql
-- Bead:      gt-r4001 (convoy-004 Security)
-- Purpose:   Enable PostgreSQL Row-Level Security (RLS) on all Conductor tables
--            to enforce organization-level tenant isolation at the database layer.
--
-- Context variables used by the application (set per-transaction):
--   app.current_org_id   -- the authenticated user's active organization ID
--   app.current_user_id  -- the authenticated user's own user ID
--
-- The application MUST call the following before any data queries:
--   SET LOCAL app.current_org_id  = '<org-id>';
--   SET LOCAL app.current_user_id = '<user-id>';
--
-- Design notes:
--   - Tables with a direct organization_id column use simple equality checks.
--   - Tables scoped through project_id use a subquery against projects.
--   - The agents table has a nullable organization_id; global agents
--     (organization_id IS NULL) are visible to all authenticated sessions.
--   - The users table is scoped to the current user via app.current_user_id.
--   - The user_secrets table is scoped to the owning user_id.
--   - The organizations table uses a membership check via organization_members
--     so a user only sees orgs they belong to.
--   - Every policy is split into SELECT, INSERT, UPDATE, DELETE for explicit
--     control and auditability.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions: safe accessors for session context variables.
-- Using current_setting(..., true) returns NULL when the GUC has not been SET,
-- which prevents "unrecognized configuration parameter" errors.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_org_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT coalesce(nullif(current_setting('app.current_org_id', true), ''), '') $$;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT coalesce(nullif(current_setting('app.current_user_id', true), ''), '') $$;


-- =============================================================================
-- 1. ORGANIZATIONS
--    A user can see/manage only the organizations they are a member of.
--    On INSERT the app is responsible for also creating the membership row
--    in the same transaction.
-- =============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- SELECT: user sees orgs where they are a member, OR the org matches the
-- session org_id (covers the common case where context is already resolved)
CREATE POLICY organizations_select ON organizations
  FOR SELECT
  USING (
    id = current_org_id()
    OR id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = current_user_id()
    )
  );

-- INSERT: permissive because the org cannot yet have a membership row at
-- INSERT time. The app layer MUST create the owner membership row in the
-- same transaction.
CREATE POLICY organizations_insert ON organizations
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: only the current session org
CREATE POLICY organizations_update ON organizations
  FOR UPDATE
  USING (id = current_org_id())
  WITH CHECK (id = current_org_id());

-- DELETE: only the current session org
CREATE POLICY organizations_delete ON organizations
  FOR DELETE
  USING (id = current_org_id());


-- =============================================================================
-- 2. ORGANIZATION_MEMBERS
--    Scoped by organization_id = current org.
--    Also allows a user to see their own membership rows across orgs
--    (needed for the "switch org" UI).
-- =============================================================================
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- SELECT: see members of your current org, plus your own memberships anywhere
CREATE POLICY organization_members_select ON organization_members
  FOR SELECT
  USING (
    organization_id = current_org_id()
    OR user_id = current_user_id()
  );

-- INSERT: only into the current org
CREATE POLICY organization_members_insert ON organization_members
  FOR INSERT
  WITH CHECK (organization_id = current_org_id());

-- UPDATE: only within the current org
CREATE POLICY organization_members_update ON organization_members
  FOR UPDATE
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- DELETE: only within the current org
CREATE POLICY organization_members_delete ON organization_members
  FOR DELETE
  USING (organization_id = current_org_id());


-- =============================================================================
-- 3. USERS
--    A user can see and modify only their own record.
--    Org member lookups are done through organization_members, not users.
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- SELECT: own record only
CREATE POLICY users_select ON users
  FOR SELECT
  USING (id = current_user_id());

-- INSERT: only for your own user ID (registration)
CREATE POLICY users_insert ON users
  FOR INSERT
  WITH CHECK (id = current_user_id());

-- UPDATE: own record only
CREATE POLICY users_update ON users
  FOR UPDATE
  USING (id = current_user_id())
  WITH CHECK (id = current_user_id());

-- DELETE: own record only
CREATE POLICY users_delete ON users
  FOR DELETE
  USING (id = current_user_id());


-- =============================================================================
-- 4. USER_SECRETS
--    Strictly scoped to the owning user. Even org admins cannot read another
--    user's encrypted secrets.
-- =============================================================================
ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;

-- SELECT: own secrets only
CREATE POLICY user_secrets_select ON user_secrets
  FOR SELECT
  USING (user_id = current_user_id());

-- INSERT: can only create secrets for yourself
CREATE POLICY user_secrets_insert ON user_secrets
  FOR INSERT
  WITH CHECK (user_id = current_user_id());

-- UPDATE: own secrets only
CREATE POLICY user_secrets_update ON user_secrets
  FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- DELETE: own secrets only
CREATE POLICY user_secrets_delete ON user_secrets
  FOR DELETE
  USING (user_id = current_user_id());


-- =============================================================================
-- 5. AGENTS
--    Has a nullable organization_id column.
--    - Org-scoped agents: visible only when organization_id matches the session.
--    - Global agents (organization_id IS NULL): visible to ALL sessions.
--    - Writes to global agents are restricted (only org-scoped writes allowed).
-- =============================================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- SELECT: org agents for the current org + global agents (NULL org_id)
CREATE POLICY agents_select ON agents
  FOR SELECT
  USING (
    organization_id = current_org_id()
    OR organization_id IS NULL
  );

-- INSERT: must belong to the current org, or be a global agent (NULL)
CREATE POLICY agents_insert ON agents
  FOR INSERT
  WITH CHECK (
    organization_id = current_org_id()
    OR organization_id IS NULL
  );

-- UPDATE: only org-scoped agents belonging to THIS org
-- (global agents are protected from tenant mutation)
CREATE POLICY agents_update ON agents
  FOR UPDATE
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- DELETE: only org-scoped agents belonging to THIS org
CREATE POLICY agents_delete ON agents
  FOR DELETE
  USING (organization_id = current_org_id());


-- =============================================================================
-- 6. AGENT_INSTANCES
--    No direct organization_id. Scoped via project_id -> projects.organization_id.
-- =============================================================================
ALTER TABLE agent_instances ENABLE ROW LEVEL SECURITY;

-- SELECT: instances in projects belonging to the current org
CREATE POLICY agent_instances_select ON agent_instances
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- INSERT: only into projects belonging to the current org
CREATE POLICY agent_instances_insert ON agent_instances
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- UPDATE: only instances in the current org's projects
CREATE POLICY agent_instances_update ON agent_instances
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- DELETE: only instances in the current org's projects
CREATE POLICY agent_instances_delete ON agent_instances
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );


-- =============================================================================
-- 7. PROJECTS
--    Direct organization_id column.
-- =============================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- SELECT: projects in the current org
CREATE POLICY projects_select ON projects
  FOR SELECT
  USING (organization_id = current_org_id());

-- INSERT: must assign to the current org
CREATE POLICY projects_insert ON projects
  FOR INSERT
  WITH CHECK (organization_id = current_org_id());

-- UPDATE: only projects in the current org (cannot move to another org)
CREATE POLICY projects_update ON projects
  FOR UPDATE
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- DELETE: only projects in the current org
CREATE POLICY projects_delete ON projects
  FOR DELETE
  USING (organization_id = current_org_id());


-- =============================================================================
-- 8. PROJECT_AGENTS
--    No direct organization_id. Scoped via project_id -> projects.organization_id.
-- =============================================================================
ALTER TABLE project_agents ENABLE ROW LEVEL SECURITY;

-- SELECT: project_agents for the current org's projects
CREATE POLICY project_agents_select ON project_agents
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- INSERT: only into the current org's projects
CREATE POLICY project_agents_insert ON project_agents
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- UPDATE: only for the current org's projects
CREATE POLICY project_agents_update ON project_agents
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- DELETE: only for the current org's projects
CREATE POLICY project_agents_delete ON project_agents
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );


-- =============================================================================
-- 9. TASKS
--    No direct organization_id. Scoped via project_id -> projects.organization_id.
-- =============================================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- SELECT: tasks in the current org's projects
CREATE POLICY tasks_select ON tasks
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- INSERT: only into the current org's projects
CREATE POLICY tasks_insert ON tasks
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- UPDATE: only tasks in the current org's projects
CREATE POLICY tasks_update ON tasks
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- DELETE: only tasks in the current org's projects
CREATE POLICY tasks_delete ON tasks
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );


-- =============================================================================
-- 10. TASK_ACTIVITIES
--     No direct organization_id or project_id. Scoped via two-level join:
--     task_id -> tasks.project_id -> projects.organization_id.
-- =============================================================================
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;

-- SELECT: activities for tasks in the current org's projects
CREATE POLICY task_activities_select ON task_activities
  FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE p.organization_id = current_org_id()
    )
  );

-- INSERT: only for tasks in the current org's projects
CREATE POLICY task_activities_insert ON task_activities
  FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE p.organization_id = current_org_id()
    )
  );

-- UPDATE: only for tasks in the current org's projects
CREATE POLICY task_activities_update ON task_activities
  FOR UPDATE
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE p.organization_id = current_org_id()
    )
  )
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE p.organization_id = current_org_id()
    )
  );

-- DELETE: only for tasks in the current org's projects
CREATE POLICY task_activities_delete ON task_activities
  FOR DELETE
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE p.organization_id = current_org_id()
    )
  );


-- =============================================================================
-- 11. FILE_LOCKS
--     No direct organization_id. Scoped via project_id -> projects.organization_id.
-- =============================================================================
ALTER TABLE file_locks ENABLE ROW LEVEL SECURITY;

-- SELECT: file locks for the current org's projects
CREATE POLICY file_locks_select ON file_locks
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- INSERT: only for the current org's projects
CREATE POLICY file_locks_insert ON file_locks
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- UPDATE: only for the current org's projects
CREATE POLICY file_locks_update ON file_locks
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- DELETE: only for the current org's projects
CREATE POLICY file_locks_delete ON file_locks
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );


-- =============================================================================
-- 12. FILE_CONFLICTS
--     No direct organization_id. Scoped via project_id -> projects.organization_id.
-- =============================================================================
ALTER TABLE file_conflicts ENABLE ROW LEVEL SECURITY;

-- SELECT: file conflicts for the current org's projects
CREATE POLICY file_conflicts_select ON file_conflicts
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- INSERT: only for the current org's projects
CREATE POLICY file_conflicts_insert ON file_conflicts
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- UPDATE: only for the current org's projects
CREATE POLICY file_conflicts_update ON file_conflicts
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- DELETE: only for the current org's projects
CREATE POLICY file_conflicts_delete ON file_conflicts
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );


-- =============================================================================
-- 13. COST_EVENTS
--     Direct organization_id column.
-- =============================================================================
ALTER TABLE cost_events ENABLE ROW LEVEL SECURITY;

-- SELECT: cost events for the current org
CREATE POLICY cost_events_select ON cost_events
  FOR SELECT
  USING (organization_id = current_org_id());

-- INSERT: must assign to the current org
CREATE POLICY cost_events_insert ON cost_events
  FOR INSERT
  WITH CHECK (organization_id = current_org_id());

-- UPDATE: only cost events for the current org
CREATE POLICY cost_events_update ON cost_events
  FOR UPDATE
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- DELETE: only cost events for the current org
CREATE POLICY cost_events_delete ON cost_events
  FOR DELETE
  USING (organization_id = current_org_id());


-- =============================================================================
-- 14. ESCALATIONS
--     No direct organization_id. Scoped via project_id -> projects.organization_id.
-- =============================================================================
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- SELECT: escalations for the current org's projects
CREATE POLICY escalations_select ON escalations
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- INSERT: only for the current org's projects
CREATE POLICY escalations_insert ON escalations
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- UPDATE: only escalations in the current org's projects
CREATE POLICY escalations_update ON escalations
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );

-- DELETE: only escalations in the current org's projects
CREATE POLICY escalations_delete ON escalations
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = current_org_id()
    )
  );


-- =============================================================================
-- 15. CONNECTOR_CONFIGS
--     Direct organization_id column.
-- =============================================================================
ALTER TABLE connector_configs ENABLE ROW LEVEL SECURITY;

-- SELECT: connector configs for the current org
CREATE POLICY connector_configs_select ON connector_configs
  FOR SELECT
  USING (organization_id = current_org_id());

-- INSERT: must assign to the current org
CREATE POLICY connector_configs_insert ON connector_configs
  FOR INSERT
  WITH CHECK (organization_id = current_org_id());

-- UPDATE: only connector configs for the current org
CREATE POLICY connector_configs_update ON connector_configs
  FOR UPDATE
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- DELETE: only connector configs for the current org
CREATE POLICY connector_configs_delete ON connector_configs
  FOR DELETE
  USING (organization_id = current_org_id());


-- =============================================================================
-- VERIFICATION QUERIES (commented out -- run manually after migration)
-- =============================================================================

/*
-- 1. Verify RLS is enabled on all 15 tables:
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations',
    'organization_members',
    'users',
    'user_secrets',
    'agents',
    'agent_instances',
    'projects',
    'project_agents',
    'tasks',
    'task_activities',
    'file_locks',
    'file_conflicts',
    'cost_events',
    'escalations',
    'connector_configs'
  )
ORDER BY tablename;
-- Expected: all 15 rows should show rowsecurity = true


-- 2. Verify policy count (should be 4 per table = 60 total):
SELECT
  tablename,
  count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations',
    'organization_members',
    'users',
    'user_secrets',
    'agents',
    'agent_instances',
    'projects',
    'project_agents',
    'tasks',
    'task_activities',
    'file_locks',
    'file_conflicts',
    'cost_events',
    'escalations',
    'connector_configs'
  )
GROUP BY tablename
ORDER BY tablename;
-- Expected: each table should have 4 policies


-- 3. Full policy listing for audit:
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual IS NOT NULL AS has_using,
  with_check IS NOT NULL AS has_with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;


-- 4. Smoke test (should return 0 rows when no session context is set):
-- SELECT count(*) FROM organizations;
-- SELECT count(*) FROM projects;
-- SELECT count(*) FROM tasks;
*/
