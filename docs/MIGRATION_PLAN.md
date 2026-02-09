# Migration Plan: habitusnet/conductor → prductr-com

Comprehensive plan for migrating from the private conductor repo to the new monorepo structure with public mirrors.

## Overview

**From**: `habitusnet/conductor` (private monorepo)
**To**:
- `habitusnet/prductr-com` (private development monorepo)
- `prductr-com/*` (public individual repos)

## Architecture

### Current State (habitusnet/conductor)
```
conductor/
├── packages/
│   ├── core/
│   ├── state/
│   ├── db/
│   ├── mcp-server/
│   ├── cli/
│   ├── e2b-runner/
│   ├── observer/
│   ├── secrets/
│   ├── connectors/
│   └── dashboard/
└── prductr-landing/  (landing site)
```

### Target State (habitusnet/prductr-com)
```
prductr-com/
├── packages/
│   ├── landing/        # From prductr-landing/
│   ├── lisa/           # NEW (skills system)
│   ├── carlos/         # NEW (skills system)
│   └── conductor/      # From packages/*
└── apps/
    └── dashboard/      # From packages/dashboard/
```

### Public Mirrors (prductr-com org)
```
github.com/prductr-com/
├── lisa/              # Public
├── carlos/            # Public
├── conductor/         # Public multi-tenant
└── prductr.com/       # Public landing site (optional)
```

---

## Phase 1: Copy Existing Code (Week 1)

### 1.1 Landing Site
```bash
# Copy prductr-landing to packages/landing
cp -r conductor/prductr-landing/* prductr-com/packages/landing/
cd prductr-com/packages/landing
npm install
npm run build  # Verify it builds
```

### 1.2 Conductor Core
```bash
# Copy conductor packages to packages/conductor
cd prductr-com/packages/conductor
mkdir -p core state db mcp-server cli e2b-runner observer secrets connectors

# Copy each package
cp -r conductor/packages/core/* packages/conductor/core/
cp -r conductor/packages/state/* packages/conductor/state/
cp -r conductor/packages/db/* packages/conductor/db/
# ... repeat for all packages
```

### 1.3 Dashboard
```bash
# Copy dashboard to apps/dashboard
cp -r conductor/packages/dashboard/* prductr-com/apps/dashboard/
```

---

## Phase 2: Extract Lisa (Weeks 2-3)

Lisa is currently embedded in the conductor codebase as skills. Extract into standalone package.

### 2.1 Identify Lisa Components

**From conductor:**
- `skills/lisa:rescue/`
- `skills/lisa:research/`
- `skills/lisa:discover/`
- `skills/lisa:plan/`
- `skills/lisa:structure/`
- `skills/lisa:reconcile/`

**Move to:**
- `packages/lisa/src/rescue/`
- `packages/lisa/src/research/`
- `packages/lisa/src/discover/`
- `packages/lisa/src/plan/`
- `packages/lisa/src/structure/`
- `packages/lisa/src/reconcile/`

### 2.2 Create Lisa Package Structure

```bash
cd packages/lisa
npm init -y

# Update package.json
{
  "name": "@prductr/lisa",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "lisa": "dist/cli.js"
  },
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "test": "vitest"
  }
}
```

### 2.3 Lisa Public API

```typescript
// packages/lisa/src/index.ts
export { rescue } from './rescue';
export { discover } from './discover';
export { plan } from './plan';
export { structure } from './structure';
export { reconcile } from './reconcile';

// CLI interface
export { cli } from './cli';
```

### 2.4 Lisa CLI

```bash
# Usage
npx @prductr/lisa rescue
npx @prductr/lisa discover
npx @prductr/lisa plan
```

---

## Phase 3: Extract Carlos (Weeks 3-4)

Carlos is currently the roadmap generation skill system.

### 3.1 Identify Carlos Components

**From conductor:**
- `skills/carlos:roadmap/`
- `skills/carlos:market-fit-auditor/`
- `skills/carlos:product-owner/`
- `skills/carlos:tech-auditor/`

**Move to:**
- `packages/carlos/src/roadmap/`
- `packages/carlos/src/market-fit/`
- `packages/carlos/src/product/`
- `packages/carlos/src/technical/`

### 3.2 Create Carlos Package Structure

```bash
cd packages/carlos
npm init -y

# Update package.json
{
  "name": "@prductr/carlos",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "carlos": "dist/cli.js"
  }
}
```

### 3.3 Carlos Public API

```typescript
// packages/carlos/src/index.ts
export { generateRoadmap } from './roadmap';
export { assessMarketFit } from './market-fit';
export { auditTechnical } from './technical';

// CLI interface
export { cli } from './cli';
```

### 3.4 Carlos CLI

```bash
# Usage
npx @prductr/carlos roadmap
npx @prductr/carlos audit
```

---

## Phase 4: Refactor Conductor (Week 5)

Restructure conductor as a cleaner multi-tenant platform.

### 4.1 Conductor Package Structure

```
packages/conductor/
├── core/           # Schemas, types, profiles
├── state/          # SQLite state store
├── db/             # Drizzle ORM (D1/Postgres)
├── mcp/            # MCP protocol server
├── cli/            # Command-line interface
├── sdk/            # Client SDK for apps
├── e2b/            # E2B sandbox integration
└── api/            # REST API endpoints
```

### 4.2 Multi-Tenant Features

**New capabilities:**
- Organization management
- Team/member access control
- Usage quotas & billing
- Audit logs
- SSO integration

### 4.3 Public vs Private

**Public (prductr-com/conductor):**
- Core orchestration engine
- MCP server
- CLI
- SDK
- Documentation

**Private (habitusnet/prductr-com):**
- Internal tools
- Proprietary integrations
- Development tooling

---

## Phase 5: Set Up Public Mirrors (Week 6)

### 5.1 Create Public Repositories

```bash
# In prductr-com org, create:
gh repo create prductr-com/lisa --public
gh repo create prductr-com/carlos --public
gh repo create prductr-com/conductor --public
```

### 5.2 Mirror Strategy

**Option A: Git Subtree (Recommended)**
```bash
# Push packages/lisa to prductr-com/lisa
git subtree push --prefix=packages/lisa origin-lisa main

# Set up remotes
git remote add origin-lisa git@github.com:prductr-com/lisa.git
git remote add origin-carlos git@github.com:prductr-com/carlos.git
git remote add origin-conductor git@github.com:prductr-com/conductor.git
```

**Option B: GitHub Actions Sync**
```yaml
# .github/workflows/sync-public.yml
name: Sync to Public Repos
on:
  push:
    branches: [main]
    paths:
      - 'packages/lisa/**'
      - 'packages/carlos/**'
      - 'packages/conductor/**'

jobs:
  sync-lisa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Push to prductr-com/lisa
        run: |
          git subtree push --prefix=packages/lisa \
            https://x-access-token:${{ secrets.PUBLIC_REPO_TOKEN }}@github.com/prductr-com/lisa.git main
```

### 5.3 Documentation Updates

Each public repo needs:
- README.md
- LICENSE (MIT)
- CONTRIBUTING.md
- CODE_OF_CONDUCT.md
- SECURITY.md

---

## Phase 6: Update Deployments (Week 7)

### 6.1 Update Vercel Projects

**Landing Site:**
- Connect to `prductr-com/prductr.com` (if public) or keep on `habitusnet/prductr-com`
- Domain: prductr.com

**Dashboard:**
- Connect to `habitusnet/prductr-com`
- Build: `cd apps/dashboard && npm run build`
- Domain: conductor.prductr.com

### 6.2 Environment Variables

Update Vercel env vars to point to new structure:
- Database connections
- API keys
- Feature flags

### 6.3 DNS Configuration

Ensure DNS is correct:
- `prductr.com` → Landing site
- `conductor.prductr.com` → Dashboard

---

## Phase 7: Testing & Validation (Week 8)

### 7.1 Automated Tests

```bash
# Run all tests in monorepo
npm run test

# Verify each package builds
cd packages/lisa && npm run build
cd packages/carlos && npm run build
cd packages/conductor && npm run build
```

### 7.2 Integration Testing

- Test Lisa rescue on real abandoned project
- Test Carlos roadmap generation
- Test Conductor multi-tenant orchestration
- Test dashboard with all features

### 7.3 Documentation Review

- Update all README files
- Create getting started guides
- Update API documentation
- Create video tutorials (optional)

---

## Rollout Timeline

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1 | Phase 1 | Monorepo structure with copied code |
| 2-3 | Phase 2 | Lisa extracted as standalone package |
| 3-4 | Phase 3 | Carlos extracted as standalone package |
| 5 | Phase 4 | Conductor refactored for multi-tenant |
| 6 | Phase 5 | Public repos created and mirrored |
| 7 | Phase 6 | Deployments updated |
| 8 | Phase 7 | Testing complete, launch ready |

---

## Risk Mitigation

### Risk 1: Breaking Changes
**Mitigation**: Keep old conductor repo as fallback until validation complete

### Risk 2: Lost Context
**Mitigation**: Document all changes, maintain CHANGELOG.md in each package

### Risk 3: Deployment Issues
**Mitigation**: Test in staging environment first, gradual rollout

### Risk 4: Public Exposure
**Mitigation**: Security audit before publishing, remove all secrets/credentials

---

## Success Criteria

- [ ] All packages build without errors
- [ ] All tests passing (1,374+)
- [ ] Public repos created and documented
- [ ] Deployments working (prductr.com, conductor.prductr.com)
- [ ] Lisa CLI functional
- [ ] Carlos CLI functional
- [ ] Conductor multi-tenant working
- [ ] No security vulnerabilities
- [ ] Documentation complete

---

## Post-Migration

1. **Deprecate old repo**: Add deprecation notice to habitusnet/conductor
2. **Update links**: All documentation points to new repos
3. **Announce launch**: Blog post, Twitter, communities
4. **Monitor**: Track issues, usage, feedback
5. **Iterate**: Continuous improvement based on feedback
