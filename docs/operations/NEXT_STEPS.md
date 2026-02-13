# Next Steps to Launch

**Last Updated:** 2026-02-13
**Commit:** 5442196
**Phase:** 7 (Week 8 - Marketplace Launch Preparation)

---

## Summary

Three convoys (000, 001, 004) have code/documentation complete but need manual execution steps. This document provides the exact commands and verification steps to complete the launch readiness work.

**Completed This Session:**
- ✅ Incident response runbook
- ✅ Analytics infrastructure code
- ✅ RLS policy design (60 policies, 15 tables)
- ✅ Domain status investigation
- ✅ Smoke test plan
- ✅ Convoy status tracking

**Remaining Manual Work:**
- ⏳ Get Cloudflare Analytics token
- ⏳ Execute domain reassignment
- ⏳ Run smoke tests
- ⏳ Deploy RLS migration
- ⏳ Configure rate limiting

---

## Step 1: Configure Cloudflare Web Analytics (5 min)

**Purpose:** Enable page view tracking on landing site (gt-ops01)

### 1a. Get Token from Cloudflare

1. Login to https://dash.cloudflare.com
2. Select zone: `prductr.com`
3. Navigate: **Analytics & Logs** > **Web Analytics**
4. Click **Add a site**
5. Site name: `prductr.com`
6. Copy the token (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### 1b. Update Landing Site Code

```bash
cd /home/groot/github/habitusnet/prductr-com
```

Edit `packages/landing/app/layout.tsx` line 20:
```tsx
data-cf-beacon='{"token": "PASTE_YOUR_TOKEN_HERE"}'
```

Replace `YOUR_CLOUDFLARE_ANALYTICS_TOKEN` with the actual token.

### 1c. Commit and Deploy

```bash
git add packages/landing/app/layout.tsx
git commit -m "chore: add Cloudflare Web Analytics token

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

cd packages/landing
vercel --prod
```

### 1d. Verify

1. Visit https://prductr.com (or current URL)
2. Wait 5-10 minutes
3. Check Cloudflare Dashboard > Web Analytics
4. Confirm page views are appearing

**Mark complete:** gt-ops01 (Cloudflare Analytics)

---

## Step 2: Fix Domain Configuration (10 min)

**Purpose:** Point prductr.com to landing site, enable echome.prductr.com (gt-d1001, gt-d1003)

### 2a. Reassign prductr.com to Landing Site

**Problem:** Domain currently points to dashboard, should point to landing site.

**Solution:**

```bash
# Remove prductr.com from dashboard project
vercel domains rm prductr.com prductr-com

# Add prductr.com to landing project
vercel domains add prductr.com prductr-landing
```

**Alternative (Vercel Dashboard UI):**
1. Go to https://vercel.com/hhnn/prductr-com/settings/domains
2. Find `prductr.com`, click **Remove**
3. Go to https://vercel.com/hhnn/prductr-landing/settings/domains
4. Click **Add** and enter `prductr.com`

### 2b. Verify Landing Site

```bash
curl -I https://prductr.com
# Expect: 200 OK, HTML from landing site (not 307 redirect to /login)
```

Visit https://prductr.com in browser — should see landing page, not auth redirect.

**Mark complete:** gt-d1001

### 2c. Configure echome.prductr.com

**Problem:** echome worker route is commented out in wrangler.toml

**Solution:**

```bash
cd /home/groot/github/prductr-com/echome
```

Edit `wrangler.toml` lines 44-46, uncomment:
```toml
[routes]
pattern = "echome.prductr.com/*"
custom_domain = true
```

Deploy:
```bash
cd apps/api
pnpm deploy
# or: npx wrangler deploy
```

**Add DNS record in Cloudflare:**
1. Go to https://dash.cloudflare.com > prductr.com > DNS > Records
2. Click **Add record**
3. Type: `CNAME`
4. Name: `echome`
5. Target: `<worker-hostname-from-deploy-output>` (e.g., `echome-api.<worker-subdomain>.workers.dev`)
6. Proxy: **Enabled** (orange cloud)
7. Click **Save**

Wait 1-2 minutes for DNS propagation.

### 2d. Verify echome API

```bash
curl -I https://echome.prductr.com/health
# Expect: 200 OK from echome API
```

**Mark complete:** gt-d1003

### 2e. Decide on conductor.prductr.com (Optional)

**Current state:** 308 redirect loop, unclear purpose.

**Options:**
1. **Remove DNS record** — Delete CNAME in Cloudflare (recommended)
2. **Point to dashboard** — Same as dashboard.prductr.com (alias)
3. **Reserve** — Keep DNS, return 503 "Coming Soon"

**Recommended:** Remove the CNAME for now.

```
Cloudflare Dashboard > DNS > Records > Delete conductor.prductr.com CNAME
```

**Mark complete:** gt-d1002

**Unblock:** Convoy-002 (Landing Redesign)

---

## Step 3: Run Smoke Tests (30-60 min)

**Purpose:** Verify Lisa and Carlos work on real repos before marketplace submission (gt-ops03)

### 3a. Test Lisa

```bash
cd /home/groot/github/habitusnet/prductr-com
/lisa:discover
```

**Expected:** Semantic memory file created, no crashes.

```bash
cd /home/groot/github/habitusnet/prductr-com/packages/conductor
/lisa:discover
```

**Expected:** Same as above.

```bash
cd /home/groot/github/prductr-com/echome
/lisa:discover
```

**Expected:** Same as above.

### 3b. Test Carlos

```bash
cd /home/groot/github/habitusnet/prductr-com
/carlos:roadmap
```

**Expected:** `scopecraft/` directory with 6 files, all substantive content.

```bash
cd /home/groot/github/habitusnet/prductr-com/packages/conductor
/carlos:roadmap
```

**Expected:** Same as above.

```bash
cd /home/groot/github/prductr-com/echome
/carlos:roadmap
```

**Expected:** Same as above.

### 3c. Document Results

Edit `docs/operations/smoke-test-plan.md` and fill in the test execution log:

| Test ID | Status | Duration | Notes | Issue # |
|---------|--------|----------|-------|---------|
| 1.1 | ✅ | 2m 30s | Success | - |
| ... | ... | ... | ... | ... |

### 3d. Fix Showstoppers (If Any)

If a test fails with a crash, hang, or empty output:
1. Create GitHub issue in relevant repo (prductr-com/lisa or prductr-com/carlos)
2. Fix the bug
3. Re-run the failed test
4. Document the fix

**Mark complete:** gt-ops03

**Unblock:** Convoy-003 (Marketplace Submissions)

---

## Step 4: Deploy RLS Migration (30-45 min)

**Purpose:** Enable multi-tenant isolation in production database (gt-r4002)

### 4a. Test Migration in Development

```bash
cd /home/groot/github/habitusnet/prductr-com/packages/conductor/db

# Apply migration to local SQLite (if using dev DB)
# or: Connect to a test Neon branch

psql $CONDUCTOR_DATABASE_URL_DEV < migrations/0001_enable_rls.sql
```

**Verify policies created:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Expected: 15 tables with rowsecurity = true
```

### 4b. Deploy to Production (Neon)

**IMPORTANT:** This is a production database change. Have rollback plan ready.

```bash
# Connect to Neon production database
psql $CONDUCTOR_DATABASE_URL < migrations/0001_enable_rls.sql
```

**Verification:**
```sql
-- Count policies (should be 60)
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';

-- Smoke test (should return 0 rows without session context)
SELECT COUNT(*) FROM projects;
```

### 4c. Update Application Code

The app must set session context variables before queries. Edit `apps/dashboard/src/lib/db.ts` or similar:

```typescript
// Before any query:
await db.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
await db.execute(sql`SET LOCAL app.current_user_id = ${userId}`);
```

Or use a transaction wrapper:
```typescript
export async function withOrgContext<T>(
  orgId: string,
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
    await tx.execute(sql`SET LOCAL app.current_user_id = ${userId}`);
    return await fn();
  });
}
```

### 4d. Enable RLS Feature Flag

Set environment variable in Vercel:
```bash
vercel env add ENABLE_RLS production
# Value: true
```

Redeploy dashboard:
```bash
cd apps/dashboard
vercel --prod
```

### 4e. Monitor for Issues

Watch for errors in Vercel logs:
```bash
vercel logs --follow
```

Check for:
- "RLS policy violation" errors
- Slow query warnings (>200ms)
- Empty result sets (incorrect policies)

### 4f. Rollback (If Needed)

If RLS causes issues:

**Option 1:** Disable feature flag
```bash
vercel env rm ENABLE_RLS production
vercel --prod
```

**Option 2:** Disable RLS on tables directly
```sql
ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;
```

**Mark complete:** gt-r4002

---

## Step 5: Implement Rate Limiting (60-90 min)

**Purpose:** Prevent API abuse before public launch (gt-s5001, gt-s5002)

### 5a. Create Rate Limiting Middleware

```bash
cd /home/groot/github/habitusnet/prductr-com/packages/conductor
```

Create `packages/conductor/rate-limiting/src/index.ts`:
```typescript
export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;

  constructor(config: { maxRequests: number; windowMs: number }) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  async check(key: string): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
  }> {
    // Token bucket implementation
    // Store state in Redis or PostgreSQL
    // Return result
  }
}
```

**Full implementation:** See RISKS_AND_DEPENDENCIES.md lines 537-565 for complete code example.

### 5b. Apply Middleware to API Routes

```typescript
// apps/dashboard/middleware.ts or API route
import { RateLimiter } from '@conductor/rate-limiting';

export async function middleware(req: Request) {
  const userId = req.headers.get('x-user-id');
  const limiter = new RateLimiter({
    maxRequests: 100,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  });

  const result = await limiter.check(userId);
  if (!result.allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'Retry-After': String(result.retryAfter),
      },
    });
  }

  // Continue to route
}
```

### 5c. Deploy Rate Limiting

```bash
cd apps/dashboard
vercel --prod
```

For echome API (Cloudflare Workers):
```bash
cd /home/groot/github/prductr-com/echome/apps/api
pnpm deploy
```

### 5d. Enable Feature Flag

```bash
vercel env add ENABLE_RATE_LIMITING production
# Value: true

# Redeploy
vercel --prod
```

### 5e. Verify

```bash
# Make 101 requests in 24 hours (should get 429 on 101st)
for i in {1..101}; do
  curl -I https://conductor.prductr.com/api/health -H "x-user-id: test-user"
done
```

**Mark complete:** gt-s5001, gt-s5002

---

## Step 6: Submit to Marketplace (60-90 min)

**Purpose:** List Lisa, Carlos, Conductor in Claude Marketplace (gt-m3001, gt-m3002, gt-m3003)

**Prerequisites:**
- ✅ Smoke tests passed (Step 3)
- ✅ Landing site live at prductr.com (Step 2)

### 6a. Prepare Marketplace Metadata

**Lisa:**
- Name: `Lisa - Project Rescue`
- Description: "Transform abandoned projects into working software through git archaeology, timeline analysis, and semantic memory extraction."
- Keywords: project-rescue, git-archaeology, abandoned-projects, semantic-memory
- Homepage: https://prductr.com/lisa
- Repository: https://github.com/prductr-com/lisa
- Support: support@prductr.com
- License: MIT

**Carlos:**
- Name: `Carlos - Product Roadmap`
- Description: "Generate strategic product roadmaps by scanning PRDs, extracting legacy tasks, and creating 6 scopecraft output files for maturity progression."
- Keywords: product-management, roadmap, strategy, scopecraft
- Homepage: https://prductr.com/carlos
- Repository: https://github.com/prductr-com/carlos
- Support: support@prductr.com
- License: MIT

**Conductor:**
- Name: `Conductor - Agent Coordination`
- Description: "Orchestrate multiple AI agents with file locking, conflict resolution, cost tracking, and oversight. Works standalone or with platform integration."
- Keywords: multi-agent, coordination, orchestration, team-collaboration
- Homepage: https://prductr.com/conductor
- Repository: https://github.com/prductr-com/conductor
- Support: support@prductr.com
- License: MIT

### 6b. Submit to Claude Marketplace

**Exact steps depend on Claude Marketplace submission process.**

General steps:
1. Go to Claude Marketplace submission portal
2. Click "Submit a skill"
3. Fill in metadata for each skill
4. Upload any required files (README, LICENSE, etc.)
5. Submit for review
6. Monitor submission status

### 6c. Track Approval

Create a tracking spreadsheet or document:

| Skill | Submitted Date | Status | Approval Date | Notes |
|-------|---------------|--------|---------------|-------|
| Lisa | 2026-02-13 | Pending | - | - |
| Carlos | 2026-02-13 | Pending | - | - |
| Conductor | 2026-02-13 | Pending | - | - |

**Expected approval time:** 1-2 weeks

**Mark complete:** gt-m3001, gt-m3002, gt-m3003

**Unblock:** Phase 8 (Growth)

---

## Completion Checklist

**Convoy-000 (Launch Readiness):**
- [x] gt-ops02: Incident runbook written
- [ ] gt-ops01: Cloudflare Analytics configured and verified
- [ ] gt-ops03: Smoke tests executed and passed

**Convoy-001 (Custom Domains):**
- [ ] gt-d1001: prductr.com points to landing site
- [ ] gt-d1002: conductor.prductr.com resolved (removed or repurposed)
- [ ] gt-d1003: echome.prductr.com configured and working

**Convoy-004 (Security):**
- [x] gt-r4001: RLS policies designed
- [ ] gt-r4002: RLS deployed to production
- [ ] gt-s5001: Rate limiting implemented
- [ ] gt-s5002: Rate limiting deployed

**Convoy-003 (Marketplace):**
- [ ] gt-m3001: Lisa submitted
- [ ] gt-m3002: Carlos submitted
- [ ] gt-m3003: Conductor submitted

---

## After Launch

**Week 1:**
- Monitor Cloudflare Analytics for traffic
- Check marketplace installation numbers
- Respond to any approval feedback
- Monitor RLS performance (query latency)
- Monitor rate limiting hit rate

**Week 2:**
- Start landing site redesign (Convoy-002)
- Implement dashboard event tracking (trackSignup, trackLogin)
- Build analytics dashboard

**Month 2:**
- Optimize marketplace listings based on data
- Add comprehensive tests (Convoy-005)
- Implement advanced features (Convoy-002, Phase 8)

---

## Support Contacts

**If issues arise:**
- Cloudflare: https://dash.cloudflare.com > Support
- Vercel: https://vercel.com/support
- Neon: https://console.neon.tech > Support
- Claude Marketplace: (TBD - check submission portal)

**Internal escalation:**
- Check `/docs/operations/runbook.md` for incident response
- Review `/docs/operations/convoy-status.md` for progress tracking
