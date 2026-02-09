# @prductr/conductor

Multi-tenant LLM orchestration platform for coordinating autonomous agents on shared codebases.

## Overview

Conductor enables multiple LLM agents (Claude, GPT, Gemini) to collaborate on the same codebase through intelligent coordination, task queuing, file locking, and cost tracking. Built for teams and organizations managing complex multi-agent workflows.

## Architecture

### Monorepo Packages

| Package | Purpose | Type |
|---------|---------|------|
| **@conductor/core** | Schemas, types, agent profiles | Core |
| **@conductor/state** | SQLite state store (legacy) | Storage |
| **@conductor/db** | Drizzle ORM (SQLite/Neon) | Storage |
| **@conductor/mcp-server** | MCP protocol server (21 tools) | Server |
| **@conductor/cli** | Command-line interface | CLI |
| **@conductor/e2b-runner** | E2B sandbox integration | Runtime |
| **@conductor/connectors** | External service integrations | Integration |
| **@conductor/observer** | Autonomous monitoring agent | Monitoring |
| **@conductor/secrets** | Secrets management (Doppler, GCP) | Security |

### Database Layers

**Two complementary database solutions:**

1. **@conductor/state** - Simple SQLite wrapper
   - Inline SQL queries
   - Single-machine deployments
   - Used by MCP server and CLI

2. **@conductor/db** - Drizzle ORM
   - SQLite (local) and PostgreSQL/Neon (production)
   - Repository pattern with organization isolation
   - Multi-tenant by design

## Multi-Tenant Features

### Organization Management

```typescript
import { createOrganization, addMember } from '@conductor/db';

// Create organization
const org = await createOrganization({
  name: 'Acme Corp',
  slug: 'acme',
});

// Add team members
await addMember(org.id, userId, 'admin');
```

### Access Control

- **Organization-level isolation** - Data scoped to organizations
- **Role-based permissions** - admin, member, viewer roles
- **Project access control** - Team-based project access
- **Agent approval workflow** - Agents must be approved to work

### Usage Tracking

```typescript
// Cost tracking per agent/task
const costs = await getCostsByAgent(agentId);
const totalCost = await getOrganizationCosts(orgId);

// Usage quotas
const quota = await getOrganizationQuota(orgId);
if (quota.exceeded) {
  throw new Error('Usage quota exceeded');
}
```

### Audit Logs

```typescript
// All actions logged
await logAction({
  organizationId,
  userId,
  action: 'task.created',
  resourceId: taskId,
  metadata: { ... },
});
```

## Core Features

### 1. Task Queuing & Dependencies

```typescript
// Create task with dependencies
const task = await createTask({
  title: 'Implement authentication',
  dependencies: ['task-001', 'task-002'],
  priority: 'high',
  assignedTo: 'agent-claude',
});

// Agent claims task
await claimTask(taskId, agentId);
```

### 2. File Locking

```typescript
// Acquire exclusive lock
const lock = await acquireLock(projectId, filePath, agentId);

// Release when done
await releaseLock(lockId);
```

### 3. Agent Lifecycle

```typescript
// Agent onboarding
const request = await requestAccess({
  agentId: 'claude-001',
  projectId: 'proj-123',
  capabilities: ['code', 'test', 'review'],
});

// Approve agent
await approveAccess(request.id, userId);

// Heartbeat monitoring
await updateHeartbeat(agentId);
```

### 4. Cost Tracking

```typescript
// Record LLM costs
await recordCost({
  agentId,
  taskId,
  model: 'claude-opus-4',
  inputTokens: 1000,
  outputTokens: 500,
  cost: 0.045,
});
```

### 5. Conflict Detection

```typescript
import { detectConflicts } from '@conductor/core';

// Detect file/task conflicts
const conflicts = detectConflicts(tasks, locks);
if (conflicts.length > 0) {
  // Handle conflicts based on strategy
  await handleConflicts(conflicts, strategy);
}
```

## MCP Protocol Integration

Conductor exposes 21 MCP tools for agent coordination:

### Task Management
- `conductor_create_task`
- `conductor_claim_task`
- `conductor_update_task`
- `conductor_complete_task`
- `conductor_list_tasks`

### File Locking
- `conductor_acquire_lock`
- `conductor_release_lock`
- `conductor_list_locks`

### Agent Management
- `conductor_register_agent`
- `conductor_request_access`
- `conductor_heartbeat`
- `conductor_list_agents`

### Project Management
- `conductor_get_project`
- `conductor_list_projects`

### Cost Tracking
- `conductor_record_cost`
- `conductor_get_costs`

### Access Control
- `conductor_approve_access`
- `conductor_reject_access`
- `conductor_list_access_requests`

### Onboarding
- `conductor_get_onboarding_config`
- `conductor_update_onboarding_config`

## Installation

```bash
# Install all packages
npm install @conductor/core @conductor/mcp-server @conductor/cli

# Or install meta-package (includes all)
npm install @prductr/conductor
```

## Usage

### MCP Server

```json
{
  "mcpServers": {
    "conductor": {
      "command": "npx",
      "args": ["@conductor/mcp-server"]
    }
  }
}
```

### CLI

```bash
# Initialize project
conductor init

# Create task
conductor task create "Implement feature X"

# List agents
conductor agents list

# Manage sandboxes
conductor sandbox create -a my-agent
conductor sandbox exec <id> "npm test"
```

### Programmatic API

```typescript
import { createDb } from '@conductor/db';
import { TaskRepository } from '@conductor/db/repositories';

const db = createDb({ type: 'sqlite', path: './conductor.db' });
const taskRepo = new TaskRepository(db);

// Create task
const task = await taskRepo.create({
  organizationId: 'org-123',
  projectId: 'proj-456',
  title: 'Implement auth',
  status: 'pending',
});
```

## E2B Sandbox Integration

Run agents in isolated sandboxes:

```typescript
import { SandboxManager, AgentRunner } from '@conductor/e2b-runner';

const manager = new SandboxManager(apiKey);

// Create sandbox
const sandbox = await manager.create('my-agent');

// Run agent
const runner = new AgentRunner(sandbox);
await runner.run('claude-code', {
  repo: 'https://github.com/org/repo',
  task: 'Fix bug in auth flow',
});
```

## Deployment

### Development

```bash
# Run MCP server locally
cd packages/mcp-server && npm run dev

# Run dashboard locally
cd apps/dashboard && npm run dev
```

### Production

**Database Options:**
- SQLite (local/development)
- Neon Postgres (production, recommended)
- Cloudflare D1 (edge deployment)

**Deployment Platforms:**
- Vercel (dashboard)
- Railway (MCP server)
- Cloudflare Workers (edge functions)

## Environment Variables

```bash
# Database
CONDUCTOR_DB=./conductor.db           # SQLite path
CONDUCTOR_DATABASE_URL=postgresql://  # Neon/Postgres URL

# E2B
E2B_API_KEY=...                      # E2B sandbox API key

# LLM Providers
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_AI_API_KEY=...

# GitHub
GITHUB_TOKEN=...

# Secrets Management
DOPPLER_TOKEN=...                    # Doppler integration
GOOGLE_CLOUD_PROJECT=...            # GCP Secret Manager
```

## Public vs Private

### Public (prductr-com/conductor)

Core orchestration engine for public use:
- Core schemas and types
- MCP protocol server
- CLI tool
- Client SDK
- E2B integration
- Documentation

### Private (habitusnet/prductr-com)

Internal tools and integrations:
- Dashboard UI (may be open-sourced later)
- Proprietary connectors
- Internal tooling
- Development utilities

## Testing

```bash
# Run all tests
npm run test

# Run package-specific tests
cd packages/core && npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

**Test Coverage:**
- @conductor/core: 146 tests
- @conductor/observer: 391 tests
- @conductor/secrets: 36 tests
- **Total: 573+ tests**

## License

MIT (for public packages)

## Links

- **Production Dashboard**: https://conductor.prductr.com
- **GitHub (Public)**: https://github.com/prductr-com/conductor
- **GitHub (Private)**: https://github.com/habitusnet/prductr-com
- **Documentation**: Coming soon

## Related Projects

- **@prductr/lisa** - Archaeological rescue agent for abandoned projects
- **@prductr/carlos** - Product roadmap and market fit assessment
