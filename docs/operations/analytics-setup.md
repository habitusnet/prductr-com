# Analytics Setup (gt-ops01)

**Bead:** gt-ops01 (Convoy-000 Launch Readiness)
**Status:** Partial - Code ready, tokens need configuration
**Last Updated:** 2026-02-13

---

## What's Implemented

1. **Landing Site** (`packages/landing/`)
   - Cloudflare Web Analytics beacon added to `app/layout.tsx`
   - Tracks: page views, referral sources, CTA clicks automatically

2. **Dashboard** (`apps/dashboard/`)
   - Analytics utility created at `src/lib/analytics.ts`
   - Events: signups, logins, agent_connections, task lifecycle
   - Storage: Reuses `cost_events` table (event_type='analytics')

---

## Required: Cloudflare Analytics Token

**Step 1:** Get token from Cloudflare Dashboard

1. Go to https://dash.cloudflare.com
2. Select the `prductr.com` zone
3. Navigate to **Analytics & Logs** > **Web Analytics**
4. Click **Add a site** (or select existing site)
5. Site name: `prductr.com`
6. Copy the **token** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Step 2:** Update landing site code

Edit `/packages/landing/app/layout.tsx`:
```tsx
<script
  defer
  src="https://static.cloudflareinsights.com/beacon.min.js"
  data-cf-beacon='{"token": "YOUR_ACTUAL_TOKEN_HERE"}'
/>
```

Replace `YOUR_CLOUDFLARE_ANALYTICS_TOKEN` with the actual token.

**Step 3:** Verify after deploy

1. Deploy landing site: `cd packages/landing && npm run build && vercel --prod`
2. Visit https://prductr.com
3. Check Cloudflare Dashboard > Web Analytics for incoming traffic

**Expected:** Page views appear within 5-10 minutes.

---

## Dashboard Event Tracking

**Integration Points:**

### 1. Track Signups (User Creation)

Add to auth callback handler (e.g., `app/api/auth/callback/route.ts`):
```typescript
import { trackSignup } from '@/lib/analytics';

// After creating user in database:
await trackSignup(userId, 'google'); // or 'github'
```

### 2. Track Logins (OAuth Success)

Add to auth middleware or session init:
```typescript
import { trackLogin } from '@/lib/analytics';

// After successful auth:
await trackLogin(userId, organizationId);
```

### 3. Track Agent Connections

Add to agent registration endpoint (e.g., `app/api/agents/route.ts`):
```typescript
import { trackAgentConnection } from '@/lib/analytics';

// After first agent registered to org:
await trackAgentConnection(organizationId, agentId, userId);
```

---

## Metrics Dashboard (Future - Phase 8)

The `getAnalyticsEvents()` function can be used to build dashboards:

```typescript
import { getAnalyticsEvents } from '@/lib/analytics';

// Get all signups in last 30 days
const signups = await getAnalyticsEvents('signup', 30);

// Get agent connections in last 7 days
const connections = await getAnalyticsEvents('agent_connection', 7);
```

**Suggested Dashboard Route:** `app/analytics/page.tsx`

Display:
- Signups/day (line chart)
- Logins/day (line chart)
- Agent connections/day (line chart)
- Top referral sources (from Cloudflare)
- Conversion funnel: Visitor → Signup → Agent connection

---

## Verification Checklist

- [ ] Cloudflare Web Analytics token configured in landing site
- [ ] Landing site deployed with analytics beacon
- [ ] Cloudflare Dashboard shows page views for prductr.com
- [ ] Dashboard analytics utility integrated into auth flow
- [ ] Signups tracked in cost_events table (event_type='analytics')
- [ ] Logins tracked in cost_events table
- [ ] Agent connections tracked in cost_events table

---

## Privacy & Compliance

**Cloudflare Web Analytics:**
- Privacy-first (no cookies, no personal data)
- GDPR compliant
- No consent banner required
- Docs: https://developers.cloudflare.com/analytics/web-analytics/

**Dashboard Event Tracking:**
- Stores user_id and organization_id (already in database)
- No third-party services
- Internal use only (not shared)
- Covered by existing ToS/Privacy Policy

---

## Cost

- **Cloudflare Web Analytics:** Free (unlimited)
- **Dashboard analytics:** $0 (uses existing database)

---

## Rollback

If analytics causes issues:

1. **Remove Cloudflare beacon** from landing site:
   ```tsx
   // Comment out or delete the <script> tag in app/layout.tsx
   ```

2. **Disable dashboard tracking**:
   ```typescript
   // In lib/analytics.ts, change all functions to no-ops:
   export async function trackEvent() { /* no-op */ }
   ```

3. **Clean up analytics data**:
   ```sql
   DELETE FROM cost_events WHERE event_type = 'analytics';
   ```

---

## Next Steps

1. **Immediate:** Get Cloudflare token and update landing site code
2. **Before launch:** Integrate dashboard tracking into auth flow
3. **Week 1:** Verify events are being tracked (check cost_events table)
4. **Month 2:** Build analytics dashboard UI (Phase 8)
