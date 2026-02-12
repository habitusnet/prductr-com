# prductr Platform Architecture Design

**Date:** 2026-02-10
**Status:** Approved
**Phase:** 6 → 7 Transition
**Version:** 1.0

---

## Executive Summary

This document defines the complete architecture for the prductr platform ecosystem, establishing a marketplace-first distribution model with flexible coordination options. The design supports three primary personas (Individual Developers, Teams/Organizations, Tool Browsers) across multiple access tiers (anonymous, OAuth-authenticated individuals, config-based teams).

**Key Architectural Decisions:**
- **Distribution:** Marketplace-first via Claude Marketplace (primary channel)
- **Coordination:** Hybrid model (standalone skills + optional platform integration)
- **Access Control:** Multi-tier (anonymous → individual OAuth → team config-based)
- **Infrastructure:** Separate domains for landing, dashboard, and testing API
- **Development:** Private monorepo development, public repo publishing
- **Data:** PostgreSQL on Neon with Row-Level Security for multi-tenancy

---

## Table of Contents

1. [Platform Architecture Overview](#1-platform-architecture-overview)
2. [Domain Architecture & Deployment](#2-domain-architecture--deployment)
3. [User Journeys & Data Flow](#3-user-journeys--data-flow)
4. [Release Strategy & Marketplace Presence](#4-release-strategy--marketplace-presence)
5. [Technical Architecture & Component Communication](#5-technical-architecture--component-communication)
6. [Authentication & Authorization Model](#6-authentication--authorization-model)
7. [Development Workflow & Publishing](#7-development-workflow--publishing)
8. [Monitoring, Cost Tracking & Operational Intelligence](#8-monitoring-cost-tracking--operational-intelligence)
9. [Data Persistence, Backup & Recovery](#9-data-persistence-backup--recovery)
10. [Implementation Roadmap & Migration Path](#10-implementation-roadmap--migration-path)

---

## 1. Platform Architecture Overview

**Marketplace-First, Hybrid-Coordination Architecture**

The prductr ecosystem consists of three architectural layers working together:

### Distribution Layer (Primary)
**Claude Marketplace as Primary Distribution Channel**

Skills distributed through Claude Marketplace provide the primary user entry point:
- **Lisa** - Archaeological rescue and semantic memory extraction
- **Carlos** - Product strategy and roadmap orchestration
- **Conductor** - Multi-agent orchestration platform
- **echome** - Remote test execution with context-aware selection
- **Tools Collection** - Curated third-party tools and plugins

Users discover prductr through marketplace search, install skills locally, and experience immediate value without platform dependency.

### Coordination Layer (Optional)
**Standalone → Platform Integration Path**

Skills operate in two modes:

**Standalone Mode (Default):**
- Runs locally in user's Claude Code environment
- Uses user's own API keys
- No platform dependency
- Full functionality for individual use
- Zero cost to prductr infrastructure

**Platform-Coordinated Mode (Optional Upgrade):**
- Skills connect to Conductor platform for orchestration
- Multi-agent coordination across team members
- Centralized cost tracking and budget management
- File conflict resolution (lock, merge, zone, review strategies)
- Escalation management for human review
- Dashboard visibility for team oversight

**Connection Methods:**
- **Individual developers:** OAuth flow (sign in with Google/GitHub)
- **Teams/organizations:** Config-based connection (project-level credentials)

### Infrastructure Layer
**Production Services Supporting Both Modes**

Core infrastructure services:
- **Neon PostgreSQL** - Multi-tenant database (15 tables, RLS isolation)
- **Conductor Dashboard** - Next.js UI on Vercel (team management, task oversight)
- **Landing Site** - Marketing/onboarding on Cloudflare Pages
- **echome API** - Test execution service on Cloudflare Workers
- **Doppler** - Secrets management (production config)

**Architecture Benefits:**
- **Low barrier to entry** - Install from marketplace, use immediately
- **Natural upgrade path** - Value drives platform adoption, not forced migration
- **Flexible deployment** - Individuals stay standalone, teams adopt coordination
- **Cost efficiency** - Only platform-connected users consume infrastructure

---

## 2. Domain Architecture & Deployment

**Multi-Domain Strategy for Service Isolation**

### Domain Mapping

| Domain | Service | Hosting | Purpose |
|--------|---------|---------|---------|
| **prductr.com** | Landing Site | Cloudflare Pages | Marketing, documentation, value prop |
| **www.prductr.com** | Landing Site (alias) | Cloudflare Pages | Canonical marketing URL |
| **conductor.prductr.com** | Dashboard | Vercel | Platform UI, team management, task oversight |
| **echome.prductr.com** | echome API | Cloudflare Workers | Test execution service |

### Deployment Architecture

**Landing Site (prductr.com):**
```
GitHub: habitusnet/prductr-com/packages/landing
  ↓ (git subtree push)
Public: prductr-com/landing
  ↓ (Cloudflare Pages auto-deploy)
Production: prductr.com + www.prductr.com
```

**Dashboard (conductor.prductr.com):**
```
GitHub: habitusnet/prductr-com/apps/dashboard
  ↓ (Vercel GitHub integration)
Production: conductor.prductr.com
  ↓ (connects to)
Database: Neon PostgreSQL (ep-crimson-mountain-ag6qegy9)
```

**echome API (echome.prductr.com):**
```
GitHub: prductr-com/echome (separate monorepo)
  ↓ (Cloudflare Workers deploy)
Production: echome.prductr.com
  ↓ (connects to)
E2B Sandboxes: Remote test execution
```

### Current Deployment Status (Phase 6)

| Service | Status | URL | Notes |
|---------|--------|-----|-------|
| Landing Site | ✅ Deployed | https://57849922.prductr-landing.pages.dev | Custom domain pending |
| Dashboard | ✅ Deployed | https://prductr-com.vercel.app | Neon Auth configured |
| Database | ✅ Live | ep-crimson-mountain-ag6qegy9-pooler | 15 tables, no RLS yet |
| Custom Domains | ⏳ Pending | - | Phase 7 task |

---

## 3. User Journeys & Data Flow

**Three Primary User Personas**

### Journey 1: Individual Developer (Standalone Mode)

**Discovery → Installation → Usage:**

1. **Discovery:** Claude Marketplace search ("task automation", "project planning")
2. **Installation:** `/skills add lisa` (or carlos, conductor)
3. **Usage:** Run skill locally with personal API keys
4. **Value:** Immediate productivity without platform signup

**Data Flow:**
```
User's Claude Code
  ↓ (skill execution)
Local filesystem + User's API keys
  ↓ (no external calls)
Results returned to user
```

**No platform dependency:** Skills run entirely locally, no prductr infrastructure used.

### Journey 2: Team/Organization (Platform-Coordinated Mode)

**Discovery → Trial → Team Adoption:**

1. **Discovery:** Individual uses skill, sees value
2. **Exploration:** Learns about platform coordination features
3. **Signup:** Creates organization account on conductor.prductr.com
4. **Configuration:** Adds project config to enable platform connection
5. **Team Onboarding:** Invites team members, assigns agents
6. **Coordination:** Multi-agent tasks orchestrated through Conductor

**Data Flow:**
```
User's Claude Code (skill execution)
  ↓ (authenticated API calls)
Conductor Platform API
  ↓ (reads/writes)
Neon PostgreSQL (multi-tenant database)
  ↓ (publishes events)
Dashboard UI (real-time updates)
  ↓ (human reviews)
Escalations (manual intervention when needed)
```

**Platform features unlocked:**
- Multi-agent task coordination
- File conflict resolution
- Cost tracking and budgets
- Escalation management
- Dashboard visibility

### Journey 3: Tool Browser (Marketplace Explorer)

**Exploration → Collection Discovery:**

1. **Browsing:** Explores Claude Marketplace
2. **Discovery:** Finds "prductr Tools" collection
3. **Evaluation:** Reviews tool descriptions, ratings, examples
4. **Installation:** Installs tools of interest
5. **Usage:** Runs tools locally (standalone mode)

**Data Flow:**
```
Claude Marketplace
  ↓ (discovery)
User installs skill
  ↓ (local execution)
Immediate value without platform
```

---

## 4. Release Strategy & Marketplace Presence

**Frequent Updates for Maximum Visibility**

### Marketplace Optimization Strategy

**Hypothesis:** Claude Marketplace promotes recently updated skills in search results and recommendations.

**Strategy:** Release frequent updates (weekly or bi-weekly) to maintain visibility:
- Minor feature additions
- Documentation improvements
- Bug fixes and performance optimizations
- Integration examples and templates

**Release Cadence:**
- **Weekly:** Small improvements, docs updates
- **Bi-weekly:** Minor features, integration enhancements
- **Monthly:** Major features, new capabilities
- **Quarterly:** Breaking changes, architecture updates

### Onboarding Philosophy: Passive, Value-Driven

**Core Principle:** Let value drive discovery, not pushy upselling.

**Approach:**
- Skills mention platform features factually when relevant
- No "Want a dashboard?" or "Upgrade now!" language
- Progressive disclosure: Show features when user hits limitations
- Natural upgrade moments: Multi-user projects, team coordination needs

**Example Messaging (Good):**

```
✓ Task created: implement-auth-flow

Note: This task is tracked locally. For multi-agent coordination
across your team, Conductor provides centralized task orchestration.
Learn more: conductor.prductr.com
```

**Example Messaging (Bad - Avoid):**

```
✗ Want a dashboard to see all your tasks? Sign up now!
✗ Upgrade to Pro for team features!
✗ Try our platform - it's better!
```

**Discovery Touchpoints:**
- Skill README files (GitHub repos)
- Error messages when hitting standalone limitations
- CLI help text mentioning platform features
- Documentation examples showing coordination use cases

---

## 5. Technical Architecture & Component Communication

**Layered Architecture for Flexible Deployment**

### System Components

**Skills Layer (Distribution):**
- **Lisa, Carlos, Conductor skills** - Published to Claude Marketplace
- **Standalone execution** - Run locally with user's API keys
- **Optional platform connection** - Enable coordination via config

**Conductor Platform (Coordination):**
- **REST API** - Task management, agent coordination endpoints
- **WebSocket** - Real-time updates for dashboard
- **MCP Protocol** - Tool integration for agent capabilities
- **E2B Integration** - Sandbox execution for code tasks

**echome Platform (Testing Infrastructure):**
- **REST API** - Test execution, context-aware selection
- **Cloudflare Workers** - Serverless test execution
- **E2B Sandboxes** - Isolated test environments
- **Rate Limiting** - Per-user quotas to prevent abuse

### Communication Patterns

**Standalone Mode:**
```
Skill (local) → User's filesystem
              → User's API keys (OpenAI, Anthropic, etc.)
              → Local results
```

**Platform-Coordinated Mode:**
```
Skill (local) → Conductor API (authenticated)
                  ↓
              PostgreSQL (multi-tenant data)
                  ↓
              Dashboard (real-time UI)
                  ↓
              MCP Tools (agent capabilities)
                  ↓
              E2B Sandboxes (code execution)
```

**Team Coordination Flow:**
```
Agent A (skill) → Creates task in Conductor
                    ↓
Agent B (skill) → Claims task from Conductor
                    ↓
File conflict detected → Conductor resolution strategy
                    ↓
Escalation needed → Human review via Dashboard
                    ↓
Resolution applied → Agents continue work
```

### API Design

**Conductor API Endpoints:**
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task details
- `PATCH /api/tasks/:id` - Update task status
- `POST /api/tasks/:id/claim` - Agent claims task
- `POST /api/escalations` - Create escalation for human review
- `GET /api/agents` - List active agents
- `POST /api/file-locks` - Request file lock
- `GET /api/cost-events` - Query cost history

**echome API Endpoints:**
- `POST /api/test-runs` - Execute test suite
- `GET /api/test-runs/:id` - Get test results
- `POST /api/context-select` - Context-aware test selection
- `GET /api/sandbox-status` - E2B sandbox health

---

## 6. Authentication & Authorization Model

**Multi-Tier Access Control**

### Access Tiers

**Tier 1: Anonymous (No Authentication)**
- **Capabilities:** Browse public documentation, explore landing site
- **Limitations:** No skill installation, no platform features
- **Use Case:** Marketing, discovery, learning

**Tier 2: Individual Account (OAuth)**
- **Authentication:** Neon Auth with Google/GitHub OAuth
- **Capabilities:**
  - Install skills from Claude Marketplace
  - Use skills in standalone mode (no auth required)
  - Optional: Connect skills to personal Conductor account
  - View personal dashboard
  - Track individual cost usage
- **Authorization:** User-scoped access (sees only own data)
- **Use Case:** Individual developers, freelancers

**Tier 3: Team/Organization (Config-Based)**
- **Authentication:** Project-level API credentials (stored in `.conductor/config.json`)
- **Capabilities:**
  - All Tier 2 features
  - Multi-agent task coordination
  - File conflict resolution
  - Team dashboard access
  - Organization-wide cost tracking
  - Invite team members
  - Manage organization settings
- **Authorization:** Organization-scoped access with role-based permissions
- **Use Case:** Development teams, agencies, enterprises

### Authentication Flows

**Individual OAuth Flow:**
```
1. User runs skill with platform features
2. Skill detects no authentication
3. Opens browser: conductor.prductr.com/auth/login
4. User signs in with Google/GitHub
5. OAuth redirect with tokens
6. Skill stores tokens locally
7. Future API calls use stored tokens
```

**Team Config-Based Flow:**
```
1. Team admin creates organization on conductor.prductr.com
2. Admin generates API credentials
3. Admin adds to project: .conductor/config.json
4. Team members' skills auto-detect config
5. Skills use project credentials for API calls
6. All team activity tracked under organization
```

### Security Considerations

**Token Storage:**
- OAuth tokens: Encrypted in user's local filesystem (`~/.conductor/credentials`)
- Team config: Project-specific (`.conductor/config.json`, gitignored)
- Secrets encryption: AES-256-GCM with master key in Doppler

**Row-Level Security (RLS):**
- PostgreSQL RLS policies enforce tenant isolation
- Queries automatically filtered by `organization_id`
- Prevents cross-tenant data leaks
- Implemented at database level (not application logic)

**API Rate Limiting:**
- **Standalone mode:** No limits (uses user's own API keys)
- **Individual accounts:** 100 requests/day (Free tier), unlimited (Pro tier)
- **Team accounts:** Unlimited (organization-billed)

---

## 7. Development Workflow & Publishing

**Private Development → Public Distribution**

### Repository Structure

**Private Development Monorepo:**
- **Repository:** `habitusnet/prductr-com`
- **Structure:**
  ```
  prductr-com/
  ├── packages/
  │   ├── landing/          # Marketing site
  │   ├── lisa/             # Archaeological rescue skill
  │   ├── carlos/           # Product strategy skill
  │   └── conductor/
  │       ├── api/          # REST API
  │       ├── db/           # Database schema (Drizzle)
  │       ├── mcp-tools/    # MCP protocol tools
  │       └── ... (10 packages total)
  └── apps/
      └── dashboard/        # Next.js UI
  ```
- **Purpose:** All development, iteration, experimentation
- **Visibility:** Private (development work, WIP features)

**Public Distribution Repos:**
- **prductr-com/lisa** - Published skill (2,072 lines)
- **prductr-com/carlos** - Published skill (2,213 lines)
- **prductr-com/conductor** - Published platform (10 packages)
- **prductr-com/echome** - Published testing platform (separate monorepo)
- **Purpose:** Clean, professional public presence for marketplace
- **Visibility:** Public (production-ready code only)

### Publishing Workflow

**Current (Manual):**
```bash
# From private repo root
git subtree push --prefix=packages/lisa lisa-public main
git subtree push --prefix=packages/carlos carlos-public main
git subtree push --prefix=packages/conductor conductor-public main
```

**Future (Automated via GitHub Actions):**
```yaml
# .github/workflows/publish.yml
on:
  push:
    tags:
      - 'v*.*.*'  # Trigger on version tags

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout private repo
      - name: Run tests
      - name: Build packages
      - name: Generate changelog
      - name: Subtree push to public repos
      - name: Update marketplace descriptions
      - name: Create GitHub releases
```

**Version Strategy:**
- **Semantic versioning:** `MAJOR.MINOR.PATCH`
- **Weekly updates:** Increment PATCH (e.g., 1.2.3 → 1.2.4)
- **New features:** Increment MINOR (e.g., 1.2.4 → 1.3.0)
- **Breaking changes:** Increment MAJOR (e.g., 1.3.0 → 2.0.0)

**Changelog Generation:**
- Use conventional commits in private repo
- Auto-generate changelog from commit messages
- Update marketplace descriptions with release notes

**Benefits:**
- Iterate freely in private without exposing experiments
- Control what goes public (no WIP, no sensitive info)
- Keep public repos clean and professional
- Ship updates frequently to maintain marketplace presence

---

## 8. Monitoring, Cost Tracking & Operational Intelligence

**Production Operations & Cost Management**

### Cost Tracking System

**Database Schema:**
- **cost_events table** - Records every API call, token usage, model invocation
  ```sql
  CREATE TABLE cost_events (
    id VARCHAR(255) PRIMARY KEY,
    organization_id VARCHAR(255) REFERENCES organizations(id),
    agent_id VARCHAR(255) REFERENCES agents(id),
    task_id VARCHAR(255) REFERENCES tasks(id),
    event_type VARCHAR(50),  -- 'api_call', 'token_usage', 'sandbox_execution'
    model_name VARCHAR(100),
    tokens_used INTEGER,
    cost_usd NUMERIC(10, 8),
    timestamp TIMESTAMP DEFAULT NOW()
  );
  ```

**Cost Attribution:**
- **Per-agent:** Track which agents consume most resources
- **Per-task:** Cost breakdown for specific tasks
- **Per-organization:** Total spend for billing/budgeting
- **Historical analysis:** Trends, optimization opportunities

**Budget Management:**
- Configurable budget limits per organization
- Real-time budget tracking (running total)
- Alerts at 80%, 90%, 100% thresholds
- Auto-pause when budget exceeded (configurable)

### Escalation System

**Database Schema:**
- **escalations table** - Tracks agent blockers, errors, human review requests
  ```sql
  CREATE TABLE escalations (
    id VARCHAR(255) PRIMARY KEY,
    task_id VARCHAR(255) REFERENCES tasks(id),
    agent_id VARCHAR(255) REFERENCES agents(id),
    severity VARCHAR(20),  -- 'info', 'warning', 'error', 'critical'
    reason TEXT,
    context JSONB,         -- Error details, logs, state
    status VARCHAR(20),    -- 'pending', 'reviewing', 'resolved'
    resolved_by VARCHAR(255),
    resolution TEXT,
    created_at TIMESTAMP,
    resolved_at TIMESTAMP
  );
  ```

**Escalation Triggers:**
- Repeated task failures (3+ attempts)
- File conflict requiring human decision
- Budget threshold exceeded
- External API errors (unrecoverable)
- Agent requests human review explicitly

**Resolution Workflow:**
1. Agent creates escalation with context
2. Dashboard shows alert to team
3. Human reviews context, makes decision
4. Human provides resolution (instructions, config change)
5. Agent receives resolution, continues work
6. Escalation marked resolved, learning captured

### Agent Activity Monitoring

**Metrics Tracked:**
- **Task execution timelines** - Start, progress, completion times
- **Agent health checks** - Heartbeat every 60 seconds
- **File lock monitoring** - Detect deadlocks, expired locks
- **Sandbox metrics** - E2B execution time, success rate, timeouts
- **Coordination metrics** - Handoff latency between agents

**Performance Monitoring:**
- **P50/P95/P99 latencies** - API response times
- **Throughput** - Requests per second
- **Error rates** - 4xx, 5xx response percentages
- **Database query performance** - Slow query log, index usage

### Rate Limiting Strategy

**Per-Service Limits:**

| Service | Tier | Limit | Enforcement |
|---------|------|-------|-------------|
| **echome API** | All users | 100 req/day | Per-user token |
| **Conductor API** | Free tier | 100 req/day | Per-user OAuth token |
| **Conductor API** | Pro tier | Unlimited | Per-org billing |
| **Skills (standalone)** | N/A | None | Local execution only |

**Implementation:**
- Token bucket algorithm (burst allowance)
- Redis for distributed rate limit state
- HTTP 429 responses with Retry-After header
- Dashboard shows rate limit consumption

### Observability Stack

**Dashboard Components:**
- **Active tasks widget** - Currently running tasks, progress bars
- **Recent escalations** - Pending human reviews
- **Cost trends chart** - Daily/weekly spend visualization
- **Agent health** - Active agents, last heartbeat
- **Performance metrics** - Latency histograms, error rates

**Logging:**
- Structured JSON logs (queryable)
- Log levels: DEBUG, INFO, WARN, ERROR, CRITICAL
- Correlation IDs for request tracing
- Centralized log aggregation (Cloudflare Logs)

**Alerting:**
- Budget threshold alerts (email, Slack)
- Critical escalations (immediate notification)
- Infrastructure health (uptime, database connectivity)
- Error rate spikes (automated incident creation)

---

## 9. Data Persistence, Backup & Recovery

**Database Architecture & Data Protection**

### Multi-Tenant Database Schema

**Neon PostgreSQL (Serverless):**
- **15 tables deployed** - organizations, users, agents, tasks, projects, escalations, cost_events, etc.
- **Connection:** `ep-crimson-mountain-ag6qegy9-pooler.c-2.eu-central-1.aws.neon.tech`
- **Driver:** `@neondatabase/serverless` (Vercel Edge compatible)
- **ORM:** Drizzle ORM for type-safe queries

**Row-Level Security (RLS) - To Be Implemented:**
```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users see only their organization's data
CREATE POLICY org_isolation ON tasks
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id')::VARCHAR);

-- Set current org in application layer
SET LOCAL app.current_org_id = 'org-abc123';
```

**Benefits:**
- Tenant isolation at database level (not application logic)
- Defense in depth (even if app logic fails, database enforces isolation)
- Automatic filtering (all queries respect RLS policies)
- Performance (PostgreSQL optimizes RLS queries)

### Data Encryption

**Encryption at Rest:**
- **Neon default:** AES-256 encryption for all stored data
- **Database connections:** TLS 1.3 for all client connections
- **Application-level encryption:** user_secrets table

**user_secrets Table (Sensitive Data):**
```sql
CREATE TABLE user_secrets (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id),
  provider VARCHAR(50),          -- 'openai', 'anthropic', 'github'
  encrypted_value TEXT,           -- AES-256-GCM encrypted
  initialization_vector TEXT,     -- IV for decryption
  auth_tag TEXT,                  -- GCM authentication tag
  created_at TIMESTAMP,
  last_used_at TIMESTAMP
);
```

**Encryption Flow:**
1. User provides API key via dashboard
2. Backend generates random IV
3. Encrypts key with AES-256-GCM using master key from Doppler
4. Stores encrypted_value, IV, auth_tag in database
5. Decrypts only when needed for agent API calls

**Master Key Management:**
- Stored in Doppler: `USER_SECRETS_MASTER_KEY`
- Rotated quarterly
- Never logged or exposed in code
- Accessed only by backend services

### Backup & Recovery Strategy

**Neon Automatic Backups:**
- **Continuous WAL archiving** - Write-Ahead Log captured in real-time
- **Point-in-time recovery (PITR)** - Restore to any second within retention window
- **Retention:** 7 days (Free tier), 30 days (Pro tier)
- **Storage:** Replicated across availability zones

**Database Branching:**
- **Feature branches** - Create ephemeral database from production snapshot
- **Testing** - Run destructive tests on branch without affecting production
- **Schema migrations** - Test migrations on branch before applying to production
- **Cost:** Branches only charged for delta storage (very cheap)

**Migration Tracking:**
- **Drizzle Kit** - Schema version history in `__drizzle_migrations` table
- **Rollback capability** - Revert failed migrations without data loss
- **Migration files** - Stored in `packages/conductor/db/migrations/`

**Disaster Recovery:**
- **RTO (Recovery Time Objective):** < 15 minutes
  - Neon provides multi-region failover
  - Promote replica to primary if region fails
- **RPO (Recovery Point Objective):** < 5 minutes
  - WAL-based replication (near real-time)
  - Minimal data loss in catastrophic failure

### Data Retention Policies

**Operational Data:**
- **cost_events:** Keep raw data for 90 days
  - After 90 days: Aggregate to daily summaries
  - Retain summaries indefinitely for historical analysis
- **task_activities:** Keep detailed logs for 90 days
  - After 90 days: Archive to cold storage (S3 Glacier)
  - Retain task metadata indefinitely
- **escalations:** Keep for 1 year
  - Used for learning, pattern detection
  - Anonymize after 1 year (remove PII)
- **file_locks/file_conflicts:** Auto-expire after 24 hours
  - Stale locks cleaned up automatically
  - Prevents deadlocks from crashed agents

**User Data:**
- **users, organizations:** Retained indefinitely (until account deletion)
- **user_secrets:** Deleted immediately upon user request
- **GDPR compliance:** Full data export and deletion on request

---

## 10. Implementation Roadmap & Migration Path

**From Current State to Target Architecture**

### Current State (Phase 6 Complete - Week 7)

**✅ Infrastructure Deployed:**
- Database: PostgreSQL on Neon (15 tables, migrations tracked)
- Dashboard: Vercel deployment (https://prductr-com.vercel.app)
- Landing: Cloudflare Pages (https://57849922.prductr-landing.pages.dev)
- Authentication: Neon Auth with Google/GitHub OAuth configured

**✅ Code Published:**
- Public repos: Lisa, Carlos, Conductor (git subtree push complete)
- Test suites: 1,374 passing tests in Conductor packages
- Documentation: CODE_OF_CONDUCT.md, SECURITY.md, README.md

**⏳ Pending:**
- Custom domains: prductr.com, conductor.prductr.com, echome.prductr.com
- Row-Level Security: RLS policies not yet implemented
- Marketplace: Skills not yet submitted to Claude Marketplace
- Landing site: Needs redesign to reflect marketplace-first architecture
- Testing: Lisa/Carlos have 0 tests (deferred to Phase 7)

### Phase 7 - Launch Preparation (Week 8)

**Priority 1: Custom Domains (Estimated: 30 minutes)**
1. ✅ Configure prductr.com in Cloudflare Pages
2. ✅ Configure www.prductr.com as alias
3. Configure conductor.prductr.com in Vercel
4. Configure echome.prductr.com in Cloudflare Workers
5. Verify SSL certificates (auto-provisioned)
6. Test all domains, update documentation

**Priority 2: Landing Site Redesign (Estimated: 4 hours)**
1. Update homepage to reflect marketplace-first architecture
2. Add sections:
   - "Start with Skills" - Install from Claude Marketplace
   - "Team Coordination" - Optional platform features
   - "Explore Tools" - Curated collection
3. Add value prop: standalone works, platform adds coordination
4. Create clear CTAs: "Install Skills" (primary), "View Platform" (secondary)
5. Add screenshots, demo videos

**Priority 3: Marketplace Submission (Estimated: 2 hours)**
1. Finalize skill descriptions, keywords
2. Create marketplace assets (icons, screenshots)
3. Write clear installation instructions
4. Submit Lisa, Carlos, Conductor to Claude Marketplace
5. Monitor approval process

**Priority 4: Row-Level Security (Estimated: 3 hours)**
1. Write RLS policies for all 15 tables
2. Test policies with multiple organizations
3. Deploy to production with feature flag (`ENABLE_RLS`)
4. Monitor performance impact
5. Gradual rollout: 10% → 50% → 100% of requests

**Priority 5: Rate Limiting (Estimated: 2 hours)**
1. Implement token bucket algorithm
2. Deploy Redis for distributed state
3. Add rate limit middleware to Conductor API
4. Test limits, tune thresholds
5. Deploy with monitoring

**Priority 6: Testing (Estimated: 6 hours)**
1. Add unit tests for Lisa commands (discover, plan, rescue)
2. Add unit tests for Carlos commands (roadmap, verify)
3. Integration tests for Conductor API endpoints
4. E2B sandbox tests (create, execute, destroy)
5. CI pipeline: run tests on every commit

**Total Estimated Time: ~17.5 hours (2-3 days)**

### Phase 8 - Post-Launch Optimization (Weeks 9-10)

**Priority 1: OAuth Flow Polish**
- Improve error handling (network failures, token expiration)
- Add token refresh logic
- Better UX for OAuth redirect flow
- Test across platforms (macOS, Linux, Windows)

**Priority 2: Team/Org Config System**
- Design `.conductor/config.json` schema
- Implement config detection in skills
- Add team invitation flow
- Role-based permissions (admin, member, viewer)

**Priority 3: echome Marketplace Listing**
- Write echome skill description
- Create marketplace assets
- Submit to Claude Marketplace
- Integrate with Conductor for coordinated testing

**Priority 4: Dashboard UI Improvements**
- Real-time task updates (WebSocket)
- Cost tracking visualizations
- Escalation management UI
- Agent activity timeline

**Priority 5: Cost Tracking Dashboard**
- Daily/weekly spend charts
- Per-agent cost breakdown
- Budget alerts configuration
- Export cost reports (CSV, PDF)

**Priority 6: Escalation Management UI**
- Pending escalations queue
- Context viewer (logs, state, errors)
- Resolution form (instructions, config changes)
- Learning capture (prevent future escalations)

### Feature Flag Strategy

**Gradual Rollout for Risk Mitigation:**

```typescript
// Feature flags in Doppler config
ENABLE_RLS=true              // Row-Level Security enforcement
ENABLE_RATE_LIMITING=true    // API rate limits
ENABLE_TEAM_CONFIG=false     // Team config-based auth (beta)
MARKETPLACE_INTEGRATION=false // Skill → platform upsell visibility
```

**Rollout Pattern:**
1. Deploy feature with flag disabled (shadow mode)
2. Enable for internal testing (10% traffic)
3. Monitor metrics, fix issues
4. Gradual rollout: 25% → 50% → 100%
5. Remove flag once stable

### Success Metrics

**Launch Week (Week 8):**
- [ ] Custom domains live (prductr.com, conductor.prductr.com)
- [ ] All skills submitted to Claude Marketplace
- [ ] RLS policies deployed and tested
- [ ] Rate limiting enforced
- [ ] Landing site redesigned

**First Month (Weeks 9-12):**
- [ ] Marketplace installations > 100
- [ ] Dashboard signups > 50
- [ ] Platform uptime > 99.5%
- [ ] Average skill rating > 4.0/5.0
- [ ] Cost per user < $5/month

**First Quarter (Weeks 13-24):**
- [ ] Active users > 500
- [ ] Teams using Conductor > 25
- [ ] Monthly recurring revenue > $1,000
- [ ] Test coverage > 80%
- [ ] Average NPS > 40

---

## Conclusion

**Complete Architecture for prductr Platform Ecosystem**

This architecture design establishes a clear, comprehensive foundation for the prductr platform, balancing marketplace-first distribution with flexible coordination options. The design supports three primary personas (Individual Developers, Teams/Organizations, Tool Browsers) across multiple access tiers, providing a natural upgrade path from standalone skills to platform-coordinated workflows.

**Key Architectural Strengths:**
- **Low barrier to entry:** Install from Claude Marketplace, use immediately without platform dependency
- **Natural upgrade path:** Value drives platform adoption organically, not forced migration
- **Flexible deployment:** Individuals stay standalone, teams adopt coordination when needed
- **Cost efficiency:** Only platform-connected users consume infrastructure resources
- **Security-first:** Multi-tenant isolation via RLS, encrypted secrets, role-based access
- **Operational intelligence:** Built-in cost tracking, escalation management, monitoring
- **Developer-friendly:** Clear separation between development (private) and distribution (public)

**Implementation Status:**
- **Phase 6 (Week 7):** Infrastructure deployed, authentication configured, code published (✅ Complete)
- **Phase 7 (Week 8):** Launch preparation (custom domains, marketplace submission, RLS, testing)
- **Phase 8+ (Weeks 9+):** Post-launch optimization (UI improvements, team features, analytics)

**Next Actions:**
1. Configure custom domains (prductr.com, conductor.prductr.com)
2. Redesign landing site to reflect marketplace-first architecture
3. Submit Lisa, Carlos, Conductor to Claude Marketplace
4. Implement Row-Level Security policies
5. Add test coverage for Lisa/Carlos

---

**Document Status:** Approved and ready for implementation
**Next Review:** Post-launch (Week 9)
**Maintained By:** Architecture team
**Last Updated:** 2026-02-10
