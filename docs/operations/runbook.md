# prductr Incident Response Runbook

**Bead:** gt-ops02 | **Convoy:** convoy-000 (Launch Readiness)
**Last updated:** 2026-02-13

---

## 1. Severity Levels

| Level | Definition | Response Time | Examples |
|-------|-----------|---------------|----------|
| **P0** | Complete outage, all users affected | Immediate (< 15 min) | Database down, DNS failure, auth broken |
| **P1** | Major feature broken, most users affected | < 30 min | Dashboard unreachable, API returning 5xx |
| **P2** | Degraded service, some users affected | < 2 hours | Slow queries, intermittent errors, one worker region down |
| **P3** | Minor issue, workaround exists | < 24 hours | UI glitch, non-critical feature broken |
| **P4** | Cosmetic / improvement | Next sprint | Typo, minor styling issue |

---

## 2. Service Health Checks

Run these first to triage:

```bash
# Landing Site (Cloudflare Pages)
curl -I https://prductr.com
# Expect: 200 OK, server: cloudflare
# Backing deployment: 57849922.prductr-landing.pages.dev

# Dashboard (Vercel / Next.js)
curl -I https://conductor.prductr.com
# Expect: 200 OK, server: Vercel
# Backing deployment: prductr-com.vercel.app

# echome API (Cloudflare Workers)
curl -I https://api.prductr.com/health
# Expect: 200 OK, server: cloudflare

# Database (Neon PostgreSQL)
psql "postgresql://ep-crimson-mountain-ag6qegy9-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require" \
  -c "SELECT 1;"
# Expect: returns 1
```

---

## 3. Rollback Procedures

### 3a. Landing Site (Cloudflare Pages)

```bash
# List recent deployments
npx wrangler pages deployments list --project-name prductr-landing

# Roll back to previous deployment
npx wrangler pages deployments rollback --project-name prductr-landing <deployment-id>
```

Alternatively: Cloudflare Dashboard > Pages > prductr-landing > Deployments > select previous > "Rollback to this deploy".

### 3b. Dashboard (Vercel)

```bash
# List recent deployments
vercel ls prductr-com

# Promote a previous deployment to production
vercel promote <deployment-url>
```

Alternatively: Vercel Dashboard > prductr-com > Deployments > triple-dot menu on previous > "Promote to Production".

### 3c. echome API (Cloudflare Workers)

```bash
# Roll back via wrangler (redeploy previous version)
npx wrangler rollback
```

Alternatively: Cloudflare Dashboard > Workers & Pages > echome > Deployments > "Rollback".

### 3d. Database (Neon PostgreSQL)

Neon supports branch-based point-in-time restore:

1. Go to Neon Console > project > Branches.
2. Create a new branch from `main` at a timestamp **before** the incident.
3. Verify data on the new branch.
4. Update connection strings to point to the restored branch (or promote it to `main`).

**Do NOT drop or reset the original branch until verified.**

### 3e. Feature Flag Rollbacks (RLS & Rate Limiting)

These are controlled by environment variables / feature flags. Disabling them is a safe first response if they are suspected as the cause.

| Flag | Purpose | Where Set |
|------|---------|-----------|
| `ENABLE_RLS` | Row-Level Security policies on Neon | Dashboard env vars (Vercel) |
| `ENABLE_RATE_LIMITING` | API rate limiting | echome Worker env vars (Cloudflare) |

**To disable RLS:**
1. Set `ENABLE_RLS=false` in Vercel environment variables.
2. Redeploy: `vercel --prod` (or trigger from dashboard).
3. If RLS policies are blocking queries directly in Postgres, connect and run:
   ```sql
   ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;
   ```

**To disable rate limiting:**
1. Set `ENABLE_RATE_LIMITING=false` in Cloudflare Worker environment variables.
2. Redeploy: `npx wrangler deploy` (or publish from dashboard).

**Re-enable after root cause is identified and fixed.** These are security controls -- do not leave them off longer than necessary.

---

## 4. Escalation Matrix

| Step | Who | When | How |
|------|-----|------|-----|
| 1 | On-call engineer | Immediately | Slack #prductr-incidents |
| 2 | Team lead | P0/P1 not resolved in 30 min | Slack DM + phone |
| 3 | Platform owners | Infrastructure-level issue | Direct contact (see below) |

**Platform contacts:**

| Service | Support Channel |
|---------|----------------|
| Cloudflare (Pages + Workers) | https://dash.cloudflare.com > Support |
| Vercel | https://vercel.com/support |
| Neon | https://console.neon.tech > Support, or support@neon.tech |

---

## 5. Post-Incident Review Template

Create a new doc after every P0 or P1 (and optionally P2). Use this structure:

```
## Incident Review: [TITLE]

**Date:** YYYY-MM-DD
**Severity:** P0 / P1 / P2
**Duration:** HH:MM (time to detect) + HH:MM (time to resolve)
**Author:** [name]

### What happened
[1-3 sentences. Plain language.]

### Timeline
- HH:MM — [event]
- HH:MM — [event]
- HH:MM — [resolved]

### Root cause
[What actually broke and why.]

### What went well
- [bullet]

### What went poorly
- [bullet]

### Action items
| Action | Owner | Due |
|--------|-------|-----|
| [thing] | [who] | [when] |
```

Store completed reviews in `/docs/operations/incidents/`.

---

*Status page is planned for Phase 8. Until then, communicate outages via Slack and direct channels.*
