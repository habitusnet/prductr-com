import { describe, it, expect, beforeEach } from "vitest";
import { createSqliteDb } from "./index";
import { createOrganizationRepository } from "./repositories/organization";
import { createProjectRepository } from "./repositories/project";
import { createTaskRepository } from "./repositories/task";
import { createAgentRepository } from "./repositories/agent";
import { extractOrgContext, requireOrgContext, hasRole, verifyResourceAccess } from "./org-context";

describe("Organization Isolation", () => {
  let db: ReturnType<typeof createSqliteDb>;
  let orgRepo: ReturnType<typeof createOrganizationRepository>;
  let projectRepo: ReturnType<typeof createProjectRepository>;
  let taskRepo: ReturnType<typeof createTaskRepository>;
  let agentRepo: ReturnType<typeof createAgentRepository>;

  beforeEach(async () => {
    db = createSqliteDb(":memory:");
    orgRepo = createOrganizationRepository(db);
    projectRepo = createProjectRepository(db);
    taskRepo = createTaskRepository(db);
    agentRepo = createAgentRepository(db);

    // Run migrations
    await db.run(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        plan TEXT DEFAULT 'free',
        billing_email TEXT,
        api_keys TEXT DEFAULT '[]',
        settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS organization_members (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        invited_at TEXT DEFAULT CURRENT_TIMESTAMP,
        joined_at TEXT
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        root_path TEXT,
        git_remote TEXT,
        git_branch TEXT DEFAULT 'main',
        conflict_strategy TEXT DEFAULT 'lock',
        budget_total REAL,
        budget_spent REAL DEFAULT 0,
        budget_alert_threshold INTEGER DEFAULT 80,
        settings TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        parent_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        assigned_to TEXT,
        claimed_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        due_at TEXT,
        dependencies TEXT DEFAULT '[]',
        blocked_by TEXT,
        estimated_tokens INTEGER,
        actual_tokens INTEGER,
        files TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        result TEXT,
        error_message TEXT,
        metadata TEXT DEFAULT '{}',
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS task_activities (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        agent_id TEXT,
        action TEXT NOT NULL,
        description TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        capabilities TEXT DEFAULT '[]',
        cost_per_token_input REAL DEFAULT 0,
        cost_per_token_output REAL DEFAULT 0,
        quota_limit INTEGER,
        quota_used INTEGER DEFAULT 0,
        quota_reset_at TEXT,
        status TEXT DEFAULT 'idle',
        last_heartbeat TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  describe("Cross-Tenant Data Leakage Prevention", () => {
    it("should isolate projects by organization", async () => {
      // Create two organizations
      const org1 = await orgRepo.create({
        id: "org-1",
        name: "Organization 1",
        slug: "org-1",
      });

      const org2 = await orgRepo.create({
        id: "org-2",
        name: "Organization 2",
        slug: "org-2",
      });

      // Create projects for each organization
      await projectRepo.create({
        id: "proj-1",
        organizationId: org1.id,
        name: "Project 1",
        slug: "project-1",
      });

      await projectRepo.create({
        id: "proj-2",
        organizationId: org2.id,
        name: "Project 2",
        slug: "project-2",
      });

      // Verify org-1 can only see their projects
      const org1Projects = await projectRepo.findByOrganization(org1.id);
      expect(org1Projects).toHaveLength(1);
      expect(org1Projects[0].id).toBe("proj-1");

      // Verify org-2 can only see their projects
      const org2Projects = await projectRepo.findByOrganization(org2.id);
      expect(org2Projects).toHaveLength(1);
      expect(org2Projects[0].id).toBe("proj-2");
    });

    it("should isolate tasks by organization through projects", async () => {
      // Setup organizations and projects
      const org1 = await orgRepo.create({
        id: "org-1",
        name: "Organization 1",
        slug: "org-1",
      });

      const org2 = await orgRepo.create({
        id: "org-2",
        name: "Organization 2",
        slug: "org-2",
      });

      const proj1 = await projectRepo.create({
        id: "proj-1",
        organizationId: org1.id,
        name: "Project 1",
        slug: "project-1",
      });

      const proj2 = await projectRepo.create({
        id: "proj-2",
        organizationId: org2.id,
        name: "Project 2",
        slug: "project-2",
      });

      // Create tasks for each project
      await taskRepo.create({
        id: "task-1",
        projectId: proj1.id,
        title: "Task 1",
        description: "Task for org 1",
      });

      await taskRepo.create({
        id: "task-2",
        projectId: proj2.id,
        title: "Task 2",
        description: "Task for org 2",
      });

      // Verify org-1 can only see their tasks
      const org1Tasks = await taskRepo.findByOrganization(org1.id);
      expect(org1Tasks).toHaveLength(1);
      expect(org1Tasks[0].id).toBe("task-1");

      // Verify org-2 can only see their tasks
      const org2Tasks = await taskRepo.findByOrganization(org2.id);
      expect(org2Tasks).toHaveLength(1);
      expect(org2Tasks[0].id).toBe("task-2");
    });

    it("should verify task access belongs to organization", async () => {
      // Setup
      const org1 = await orgRepo.create({
        id: "org-1",
        name: "Organization 1",
        slug: "org-1",
      });

      const org2 = await orgRepo.create({
        id: "org-2",
        name: "Organization 2",
        slug: "org-2",
      });

      const proj1 = await projectRepo.create({
        id: "proj-1",
        organizationId: org1.id,
        name: "Project 1",
        slug: "project-1",
      });

      await taskRepo.create({
        id: "task-1",
        projectId: proj1.id,
        title: "Task 1",
      });

      // Verify org-1 has access to task-1
      const hasAccess1 = await taskRepo.verifyTaskAccess("task-1", org1.id);
      expect(hasAccess1).toBe(true);

      // Verify org-2 does NOT have access to task-1
      const hasAccess2 = await taskRepo.verifyTaskAccess("task-1", org2.id);
      expect(hasAccess2).toBe(false);
    });

    it("should isolate agents by organization", async () => {
      const org1 = await orgRepo.create({
        id: "org-1",
        name: "Organization 1",
        slug: "org-1",
      });

      const org2 = await orgRepo.create({
        id: "org-2",
        name: "Organization 2",
        slug: "org-2",
      });

      // Create org-specific agents
      await agentRepo.create({
        id: "agent-1",
        organizationId: org1.id,
        name: "Agent 1",
        provider: "anthropic",
        model: "claude-sonnet-4",
      });

      await agentRepo.create({
        id: "agent-2",
        organizationId: org2.id,
        name: "Agent 2",
        provider: "anthropic",
        model: "claude-sonnet-4",
      });

      // Create global agent (no organization)
      await agentRepo.create({
        id: "agent-global",
        name: "Global Agent",
        provider: "anthropic",
        model: "claude-sonnet-4",
      });

      // Verify org-1 sees only their agent
      const org1Agents = await agentRepo.findByOrganization(org1.id);
      expect(org1Agents).toHaveLength(1);
      expect(org1Agents[0].id).toBe("agent-1");

      // Verify org-2 sees only their agent
      const org2Agents = await agentRepo.findByOrganization(org2.id);
      expect(org2Agents).toHaveLength(1);
      expect(org2Agents[0].id).toBe("agent-2");

      // Verify global agents are separate
      const globalAgents = await agentRepo.findGlobal();
      expect(globalAgents).toHaveLength(1);
      expect(globalAgents[0].id).toBe("agent-global");
    });
  });

  describe("Organization Context Extraction", () => {
    it("should extract org context from headers", () => {
      const headers = new Headers({
        "x-organization-id": "org-123",
        "x-user-id": "user-456",
        "x-user-role": "admin",
      });

      const context = extractOrgContext(headers);
      expect(context).toEqual({
        organizationId: "org-123",
        userId: "user-456",
        role: "admin",
      });
    });

    it("should extract org context from query params", () => {
      const headers = new Headers();
      const searchParams = new URLSearchParams({
        organizationId: "org-123",
        userId: "user-456",
      });

      const context = extractOrgContext(headers, searchParams);
      expect(context).toEqual({
        organizationId: "org-123",
        userId: "user-456",
      });
    });

    it("should prefer headers over query params", () => {
      const headers = new Headers({
        "x-organization-id": "org-from-header",
      });
      const searchParams = new URLSearchParams({
        organizationId: "org-from-query",
      });

      const context = extractOrgContext(headers, searchParams);
      expect(context?.organizationId).toBe("org-from-header");
    });

    it("should return null if no context found", () => {
      const headers = new Headers();
      const context = extractOrgContext(headers);
      expect(context).toBeNull();
    });

    it("should throw error when context required but missing", () => {
      const headers = new Headers();
      expect(() => requireOrgContext(headers)).toThrow(
        "Organization context required",
      );
    });
  });

  describe("Role-Based Access Control", () => {
    it("should check role hierarchy correctly", () => {
      // Owner has highest permissions
      expect(hasRole({ organizationId: "org-1", role: "owner" }, "owner")).toBe(
        true,
      );
      expect(hasRole({ organizationId: "org-1", role: "owner" }, "admin")).toBe(
        true,
      );
      expect(
        hasRole({ organizationId: "org-1", role: "owner" }, "member"),
      ).toBe(true);

      // Admin cannot perform owner actions
      expect(hasRole({ organizationId: "org-1", role: "admin" }, "owner")).toBe(
        false,
      );
      expect(hasRole({ organizationId: "org-1", role: "admin" }, "admin")).toBe(
        true,
      );
      expect(
        hasRole({ organizationId: "org-1", role: "admin" }, "member"),
      ).toBe(true);

      // Member cannot perform admin actions
      expect(
        hasRole({ organizationId: "org-1", role: "member" }, "admin"),
      ).toBe(false);
      expect(
        hasRole({ organizationId: "org-1", role: "member" }, "member"),
      ).toBe(true);

      // No role means no permissions
      expect(hasRole({ organizationId: "org-1" }, "member")).toBe(false);
    });
  });

  describe("Resource Access Verification", () => {
    it("should verify project access", async () => {
      const org = await orgRepo.create({
        id: "org-1",
        name: "Organization 1",
        slug: "org-1",
      });

      await projectRepo.create({
        id: "proj-1",
        organizationId: org.id,
        name: "Project 1",
        slug: "project-1",
      });

      const context = { organizationId: org.id };

      const hasAccess = await verifyResourceAccess(
        db,
        context,
        "project",
        "proj-1",
      );
      expect(hasAccess).toBe(true);

      const noAccess = await verifyResourceAccess(
        db,
        { organizationId: "wrong-org" },
        "project",
        "proj-1",
      );
      expect(noAccess).toBe(false);
    });

    it("should verify task access through project", async () => {
      const org = await orgRepo.create({
        id: "org-1",
        name: "Organization 1",
        slug: "org-1",
      });

      const proj = await projectRepo.create({
        id: "proj-1",
        organizationId: org.id,
        name: "Project 1",
        slug: "project-1",
      });

      await taskRepo.create({
        id: "task-1",
        projectId: proj.id,
        title: "Task 1",
      });

      const context = { organizationId: org.id };

      const hasAccess = await verifyResourceAccess(
        db,
        context,
        "task",
        "task-1",
      );
      expect(hasAccess).toBe(true);

      const noAccess = await verifyResourceAccess(
        db,
        { organizationId: "wrong-org" },
        "task",
        "task-1",
      );
      expect(noAccess).toBe(false);
    });

    it("should verify agent access", async () => {
      const org = await orgRepo.create({
        id: "org-1",
        name: "Organization 1",
        slug: "org-1",
      });

      await agentRepo.create({
        id: "agent-1",
        organizationId: org.id,
        name: "Agent 1",
        provider: "anthropic",
        model: "claude-sonnet-4",
      });

      const context = { organizationId: org.id };

      const hasAccess = await verifyResourceAccess(
        db,
        context,
        "agent",
        "agent-1",
      );
      expect(hasAccess).toBe(true);

      const noAccess = await verifyResourceAccess(
        db,
        { organizationId: "wrong-org" },
        "agent",
        "agent-1",
      );
      expect(noAccess).toBe(false);
    });
  });

  describe("Organization Member Management", () => {
    it("should add and retrieve members", async () => {
      const org = await orgRepo.create({
        id: "org-1",
        name: "Organization 1",
        slug: "org-1",
      });

      await orgRepo.addMember({
        id: "member-1",
        organizationId: org.id,
        userId: "user-1",
        role: "admin",
      });

      await orgRepo.addMember({
        id: "member-2",
        organizationId: org.id,
        userId: "user-2",
        role: "member",
      });

      const members = await orgRepo.getMembers(org.id);
      expect(members).toHaveLength(2);
    });

    it("should get specific member", async () => {
      const org = await orgRepo.create({
        id: "org-1",
        name: "Organization 1",
        slug: "org-1",
      });

      await orgRepo.addMember({
        id: "member-1",
        organizationId: org.id,
        userId: "user-1",
        role: "admin",
      });

      const member = await orgRepo.getMember(org.id, "user-1");
      expect(member).toBeDefined();
      expect(member?.role).toBe("admin");
    });
  });
});
